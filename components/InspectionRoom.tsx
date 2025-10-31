import React, { useEffect } from 'react';
import { InspectionReport, UserRole, InspectionStatus, InspectionParameter, ProductDetails, Evidence, Notification, NotificationType, User, ChatMessage } from '../types';
import VideoGrid from './VideoGrid';
import InspectionForm from './InspectionForm';
import ResultsDashboard from './ResultsDashboard';
import DigitalTagModal from './DigitalTagModal';
import AIAssistant from './AIAssistant';
import PhotoEvidence from './PhotoEvidence';
import NotificationBell from './NotificationBell';
import Chat from './Chat';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface InspectionRoomProps {
  currentUser: User | null;
  userRole: UserRole;
  report: InspectionReport;
  onUpdateParameter: (id: number, updatedValues: Partial<InspectionParameter>) => void;
  onUpdateProductDetails: (updatedValues: Partial<ProductDetails>) => void;
  onAddParameter: () => void;
  onRemoveParameter: (id: number) => void;
  onGenerateGdtImage: (id: number) => void;
  onAddEvidenceToParameter: (parameterId: number, evidenceItem: Evidence) => void;
  onRemoveEvidenceFromParameter: (parameterId: number, evidenceIndex: number) => void;
  onSignOff: (role: UserRole, comment: string) => void;
  onAddEvidence: (evidenceItem: Evidence) => void;
  onCompleteInspection: (finalStatus: InspectionStatus) => void;
  onExit: () => void;
  saveStatus: SaveStatus;
  notifications: Notification[];
  onAddNotification: (userId: number, message: string, type: NotificationType, link?: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string, senderRole: UserRole) => void;
}

const InspectionRoom: React.FC<InspectionRoomProps> = ({
  currentUser,
  userRole,
  report,
  onUpdateParameter,
  onUpdateProductDetails,
  onAddParameter,
  onRemoveParameter,
  onGenerateGdtImage,
  onAddEvidenceToParameter,
  onRemoveEvidenceFromParameter,
  onSignOff,
  onAddEvidence,
  onCompleteInspection,
  onExit,
  saveStatus,
  notifications,
  onAddNotification,
  onMarkRead,
  onMarkAllRead,
  chatMessages,
  onSendMessage,
}) => {
  
  // Notify inspector when another participant joins
  useEffect(() => {
    // Only trigger for non-logged-in participants (Supervisor, Client, etc.)
    if (!currentUser && userRole !== UserRole.INSPECTOR) {
        onAddNotification(
            report.scheduledById,
            `${userRole} has joined inspection "${report.title}".`,
            NotificationType.INFO,
            `#/inspection/${report.id}`
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on component mount

  const relevantNotifications = currentUser ? notifications : [];

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      <header className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
        <div>
            <h1 className="text-xl font-bold text-cyan-400">Qopikun Digital Inspection Room</h1>
            <p className="text-sm text-gray-400">Inspection ID: {report.id} | Your Role: <span className="font-semibold text-cyan-300">{userRole}</span></p>
        </div>
        <div className="flex items-center gap-4">
            {currentUser && (
                <NotificationBell 
                    notifications={relevantNotifications}
                    onMarkRead={onMarkRead}
                    onMarkAllRead={onMarkAllRead}
                />
            )}
            <button
                onClick={onExit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
                {userRole === UserRole.INSPECTOR || userRole === UserRole.ADMIN ? "Back to Dashboard" : "Exit Room"}
            </button>
        </div>
      </header>
      
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-y-hidden">
        {/* Main Content: Inspection Form & Photo Evidence */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg flex flex-col overflow-y-auto">
          <InspectionForm
            report={report}
            isEditable={userRole === UserRole.INSPECTOR}
            onUpdateParameter={onUpdateParameter}
            onUpdateProductDetails={onUpdateProductDetails}
            onAddParameter={onAddParameter}
            onRemoveParameter={onRemoveParameter}
            onGenerateGdtImage={onGenerateGdtImage}
            onAddEvidenceToParameter={onAddEvidenceToParameter}
            onRemoveEvidenceFromParameter={onRemoveEvidenceFromParameter}
            saveStatus={saveStatus}
          />
          <PhotoEvidence
            evidence={report.evidence}
            isEditable={userRole === UserRole.INSPECTOR}
            onAddEvidence={onAddEvidence}
          />
        </div>

        {/* Sidebar: Video and Dashboard */}
        <aside className="lg:col-span-1 bg-gray-800 rounded-lg flex flex-col gap-4 p-4 overflow-y-auto">
          <VideoGrid currentUserRole={userRole} />
          <Chat 
            messages={chatMessages}
            currentUserRole={userRole}
            onSendMessage={onSendMessage}
          />
          <ResultsDashboard 
            report={report}
            userRole={userRole}
            onSignOff={onSignOff}
            onCompleteInspection={onCompleteInspection}
          />
          <AIAssistant report={report} />
        </aside>
      </main>

      {report.isComplete && report.finalStatus && (
        <DigitalTagModal status={report.finalStatus} inspectionId={report.id} onNewInspection={onExit} />
      )}
    </div>
  );
};

export default InspectionRoom;
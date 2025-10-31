import React, { useState, useCallback, useEffect } from 'react';
import { InspectionReport, UserRole, User, ParameterStatus, InspectionStatus, InspectionParameter, ProductDetails, Evidence, Notification, NotificationType, ChatMessage } from './types';
import { authenticateUser, getInspectionById, updateInspection, addNotification as dbAddNotification, getNotificationsForUser, markNotificationAsRead, markAllNotificationsAsRead, getChatMessagesForInspection, addChatMessage } from './data/db';
import LoginScreen from './components/LoginScreen';
import InspectionRoom from './components/InspectionRoom';
import AdminPanel from './components/AdminPanel';
import InspectorDashboard from './components/InspectorDashboard';
import JoinScreen from './components/JoinScreen';
import { generateGdtImage } from './services/geminiService';
import { GDT_SYMBOLS } from './constants';

export type Theme = 'light' | 'dark' | 'ambient';
type SaveStatus = 'idle' | 'saving' | 'saved';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'join' | 'admin' | 'inspector_dashboard' | 'inspection_room'>('login');
  const [inspectionReport, setInspectionReport] = useState<InspectionReport | null>(null);
  const [joiningRole, setJoiningRole] = useState<UserRole | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);


  // Persist inspection report changes automatically
  useEffect(() => {
    if (inspectionReport) {
      setSaveStatus('saving');
      const handler = setTimeout(async () => {
        await updateInspection(inspectionReport);
        setSaveStatus('saved');
        const clearStatusHandler = setTimeout(() => setSaveStatus('idle'), 2000);
        return () => clearTimeout(clearStatusHandler);
      }, 500); // Debounce saving

      return () => clearTimeout(handler);
    }
  }, [inspectionReport]);
  
  // Load notifications for the current user
  useEffect(() => {
    if (currentUser) {
      getNotificationsForUser(currentUser.id).then(setNotifications);
    } else {
      setNotifications([]);
    }
  }, [currentUser]);

  // Load chat messages when an inspection is active
  useEffect(() => {
    if (view === 'inspection_room' && inspectionReport) {
        getChatMessagesForInspection(inspectionReport.id).then(setChatMessages);
    } else {
        setChatMessages([]);
    }
  }, [view, inspectionReport]);


  const handleAddNotification = useCallback(async (userId: number, message: string, type: NotificationType, link?: string) => {
    await dbAddNotification(userId, message, type, link);
    // If the notification is for the current user, update state immediately
    if (currentUser && currentUser.id === userId) {
      setNotifications(await getNotificationsForUser(userId));
    }
  }, [currentUser]);
  
  const handleMarkRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    if(currentUser) {
        setNotifications(await getNotificationsForUser(currentUser.id));
    }
  }, [currentUser]);

  const handleMarkAllRead = useCallback(async () => {
    if(currentUser) {
        await markAllNotificationsAsRead(currentUser.id);
        setNotifications(await getNotificationsForUser(currentUser.id));
    }
  }, [currentUser]);

  const loadInspection = useCallback(async (inspectionId: string) => {
    const inspection = await getInspectionById(inspectionId);
    if (inspection) {
      setInspectionReport(inspection);
      return true;
    }
    return false;
  }, []);

  const handleSendMessage = useCallback(async (message: string, senderRole: UserRole) => {
    if (!inspectionReport) return;
    const newMessage: Omit<ChatMessage, 'id'> = {
        inspectionId: inspectionReport.id,
        senderRole,
        message,
        timestamp: new Date().toISOString(),
    };
    await addChatMessage(newMessage);
    setChatMessages(await getChatMessagesForInspection(inspectionReport.id));
  }, [inspectionReport]);

  // Handle routing based on URL hash on initial load
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/inspection/')) {
        setIsLoadingInspection(true);
        const inspectionId = hash.substring('#/inspection/'.length);
        const success = await loadInspection(inspectionId);
        setIsLoadingInspection(false);
        if (success) {
          setView('join');
        } else {
          alert('Inspection not found.');
          window.location.hash = '';
          setView('login');
        }
      } else if (currentUser) {
          if (currentUser.role === UserRole.ADMIN) setView('admin');
          else if (currentUser.role === UserRole.INSPECTOR) setView('inspector_dashboard');
      } else {
          setView('login');
      }
    };
    handleHashChange(); // Check on initial load
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loadInspection, currentUser]);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    const user = await authenticateUser(username, password);
    if (user) {
      setCurrentUser(user as User); // cast as full User
      if (user.role === UserRole.ADMIN) {
        setView('admin');
      } else if (user.role === UserRole.INSPECTOR) {
        setView('inspector_dashboard');
      } else {
        alert('This login is for Admins and Inspectors only. Please use an inspection link to join as another role.');
        return false;
      }
      return true;
    }
    return false;
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setInspectionReport(null);
    setJoiningRole(null);
    if(window.location.hash) {
      window.location.href = window.location.href.split('#')[0];
    }
    setView('login');
  };

  const handleJoin = (role: UserRole) => {
    setJoiningRole(role);
    setView('inspection_room');
  };

  const handleStartInspection = async (inspection: InspectionReport) => {
    await loadInspection(inspection.id);
    window.location.hash = `#/inspection/${inspection.id}`;
    setView('inspection_room');
  };

  const handleLeaveRoom = () => {
    if (currentUser?.role === UserRole.INSPECTOR) {
      setView('inspector_dashboard');
    } else if (currentUser?.role === UserRole.ADMIN) {
      setView('admin');
    }
    else {
      handleLogout();
      return; // handleLogout will redirect
    }
    setInspectionReport(null);
    window.location.hash = '';
  };

  const handleUpdateProductDetails = useCallback((updatedValues: Partial<ProductDetails>) => {
    setInspectionReport(prev => {
        if (!prev) return null;
        return {
            ...prev,
            productDetails: { ...prev.productDetails, ...updatedValues }
        };
    });
  }, []);

  const handleUpdateParameter = useCallback((id: number, updatedValues: Partial<InspectionParameter>) => {
    setInspectionReport(prevReport => {
        if (!prevReport) return null;
        const newParameters = prevReport.parameters.map(p => {
            if (p.id === id) {
                const newParam = { ...p, ...updatedValues };

                // Recalculate UTL/LTL if nominal or tolerance changes
                if ('nominal' in updatedValues || 'toleranceType' in updatedValues || 'toleranceValue' in updatedValues) {
                    const nominal = newParam.nominal;
                    const tolValue = newParam.toleranceValue ?? 0;
                    switch (newParam.toleranceType) {
                        case '+/-':
                            newParam.utl = nominal + tolValue;
                            newParam.ltl = nominal - tolValue;
                            break;
                        case '+':
                            newParam.utl = nominal + tolValue;
                            newParam.ltl = nominal;
                            break;
                        case '-':
                            newParam.utl = nominal;
                            newParam.ltl = nominal - tolValue;
                            break;
                    }
                }

                // If 'actual' value is cleared from the input
                if ('actual' in updatedValues && updatedValues.actual === undefined) {
                    newParam.deviation = undefined;
                    newParam.status = ParameterStatus.PENDING;
                } 
                // If 'actual' has a value, always recalculate deviation and status.
                else if (newParam.actual !== undefined) {
                    newParam.deviation = newParam.actual - newParam.nominal;
                    newParam.status = newParam.actual >= newParam.ltl && newParam.actual <= newParam.utl ? ParameterStatus.PASS : ParameterStatus.FAIL;
                }
                return newParam;
            }
            return p;
        });
        return { ...prevReport, parameters: newParameters };
    });
  }, []);

  const handleAddParameter = useCallback(() => {
    setInspectionReport(prevReport => {
      if (!prevReport) return null;
      
      const newId = prevReport.parameters.length > 0 
        ? Math.max(...prevReport.parameters.map(p => p.id)) + 1 
        : 1;

      const newParameter: InspectionParameter = {
        id: newId,
        description: 'New Parameter',
        nominal: 0,
        utl: 0,
        ltl: 0,
        toleranceType: '+/-',
        toleranceValue: 0,
        status: ParameterStatus.PENDING,
      };

      return {
        ...prevReport,
        parameters: [...prevReport.parameters, newParameter]
      };
    });
  }, []);

  const handleRemoveParameter = useCallback((id: number) => {
    setInspectionReport(prevReport => {
      if (!prevReport) return null;
      
      const newParameters = prevReport.parameters.filter(p => p.id !== id);

      return {
        ...prevReport,
        parameters: newParameters
      };
    });
  }, []);

  const handleGenerateGdtImage = useCallback(async (parameterId: number) => {
    const param = inspectionReport?.parameters.find(p => p.id === parameterId);
    if (!param || !param.gdtSymbol) {
      console.error("Parameter or GDT symbol not found.");
      return;
    }

    const gdtInfo = GDT_SYMBOLS.find(s => s.symbol === param.gdtSymbol);
    if (!gdtInfo) {
      console.error("GDT symbol details not found in constants.");
      return;
    }

    handleUpdateParameter(parameterId, { gdtImage: 'loading' });

    try {
      const imageDataUrl = await generateGdtImage(gdtInfo.name, gdtInfo.symbol);
      handleUpdateParameter(parameterId, { gdtImage: imageDataUrl });
    } catch (error) {
      console.error("Failed to generate GDT image.", error);
      handleUpdateParameter(parameterId, { gdtImage: undefined });
      alert("Sorry, the AI image generator failed. Please try again.");
    }
  }, [inspectionReport, handleUpdateParameter]);

  const handleSignOff = useCallback((role: UserRole, comment: string) => {
    setInspectionReport(prev => {
        if (!prev) return null;

        handleAddNotification(
            prev.scheduledById,
            `${role} has signed off on inspection "${prev.title}".`,
            NotificationType.INFO,
            `#/inspection/${prev.id}`
        );

        return {
            ...prev,
            signatures: { 
                ...prev.signatures, 
                [role]: { signed: true, comment, timestamp: new Date().toISOString() } 
            }
        };
    });
  }, [handleAddNotification]);

  const handleAddEvidence = useCallback((evidenceItem: Evidence) => {
    setInspectionReport(prev => {
        if (!prev) return null;
        return {
            ...prev,
            evidence: [...prev.evidence, evidenceItem]
        };
    });
  }, []);

  const handleAddEvidenceToParameter = useCallback((parameterId: number, evidenceItem: Evidence) => {
    setInspectionReport(prev => {
        if (!prev) return null;
        const newParameters = prev.parameters.map(p => {
            if (p.id === parameterId) {
                const updatedEvidence = [...(p.evidence || []), evidenceItem];
                return { ...p, evidence: updatedEvidence };
            }
            return p;
        });
        return { ...prev, parameters: newParameters };
    });
  }, []);

  const handleRemoveEvidenceFromParameter = useCallback((parameterId: number, evidenceIndex: number) => {
    setInspectionReport(prev => {
        if (!prev) return null;
        const newParameters = prev.parameters.map(p => {
            if (p.id === parameterId) {
                const updatedEvidence = [...(p.evidence || [])];
                updatedEvidence.splice(evidenceIndex, 1);
                return { ...p, evidence: updatedEvidence };
            }
            return p;
        });
        return { ...prev, parameters: newParameters };
    });
  }, []);

  const completeInspection = useCallback((finalStatus: InspectionStatus) => {
    setInspectionReport(prev => {
        if (!prev) return null;
        console.log(`Inspection ${prev.id} completed with status: ${finalStatus}. An email would be sent here.`);
        
        handleAddNotification(
            prev.scheduledById,
            `Inspection "${prev.title}" is complete with status: ${finalStatus}.`,
            NotificationType.SUCCESS,
            `#/inspection/${prev.id}`
        );

        return {
            ...prev,
            isComplete: true,
            finalStatus
        };
    });
  }, [handleAddNotification]);

  const renderContent = () => {
    switch (view) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} theme={theme} onThemeChange={setTheme} isLoadingInspection={isLoadingInspection} />;
      case 'join':
        return <JoinScreen onJoin={handleJoin} inspectionTitle={inspectionReport?.title || 'Inspection'}/>;
      case 'admin':
        if (currentUser && currentUser.role === UserRole.ADMIN) {
          return <AdminPanel 
            currentUser={currentUser} 
            onLogout={handleLogout}
            notifications={notifications}
            onAddNotification={handleAddNotification}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
           />;
        }
        break;
      case 'inspector_dashboard':
        if (currentUser && currentUser.role === UserRole.INSPECTOR) {
          return <InspectorDashboard 
            currentUser={currentUser} 
            onStartInspection={handleStartInspection} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />;
        }
        break;
      case 'inspection_room':
        const currentRole = currentUser?.role || joiningRole;
        if (currentRole && inspectionReport) {
          return (
            <InspectionRoom
              currentUser={currentUser}
              userRole={currentRole}
              report={inspectionReport}
              onUpdateParameter={handleUpdateParameter}
              onUpdateProductDetails={handleUpdateProductDetails}
              onAddParameter={handleAddParameter}
              onRemoveParameter={handleRemoveParameter}
              onGenerateGdtImage={handleGenerateGdtImage}
              onAddEvidenceToParameter={handleAddEvidenceToParameter}
              onRemoveEvidenceFromParameter={handleRemoveEvidenceFromParameter}
              onSignOff={handleSignOff}
              onAddEvidence={handleAddEvidence}
              onCompleteInspection={completeInspection}
              onExit={handleLeaveRoom}
              saveStatus={saveStatus}
              notifications={notifications}
              onAddNotification={handleAddNotification}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
            />
          );
        }
        break;
    }
    // Fallback to login
    handleLogout();
    return <LoginScreen onLogin={handleLogin} theme={theme} onThemeChange={setTheme} />;
  }

  const themeClasses: Record<Theme, string> = {
    light: 'bg-gray-100 text-gray-800',
    dark: 'bg-gray-900 text-white',
    ambient: 'bg-gradient-to-br from-slate-900 via-indigo-900 to-gray-900 text-white'
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${themeClasses[theme]}`}>
      {renderContent()}
    </div>
  );
};

export default App;
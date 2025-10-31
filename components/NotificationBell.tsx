import React, { useState, useEffect, useRef } from 'react';
import { Notification, NotificationType } from '../types';
import { BellIcon, CheckCircleIcon } from './icons';

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onMarkRead, onMarkAllRead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleToggle = () => setIsOpen(!isOpen);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
        onMarkRead(notification.id);
    }
    if (notification.link) {
        window.location.hash = notification.link;
    }
    setIsOpen(false);
  };
  
  const timeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={handleToggle} className="relative p-2 text-gray-400 hover:text-white transition-colors">
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
          <div className="p-3 flex justify-between items-center border-b border-gray-700">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-xs text-cyan-400 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-3 border-b border-gray-700/50 cursor-pointer ${notif.read ? 'opacity-60' : 'bg-gray-700/30'} hover:bg-gray-700/60 transition-colors`}
                >
                  {!notif.read && <span className="mt-1.5 w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0"></span>}
                  <div className={`flex-grow ${notif.read ? 'pl-5' : ''}`}>
                    <p className="text-sm text-gray-300">{notif.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{timeSince(notif.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 p-6">
                <CheckCircleIcon className="w-10 h-10 mx-auto mb-2" />
                <p>You're all caught up!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

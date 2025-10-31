import Dexie, { Table } from 'dexie';
import { User, UserRole, InspectionReport, Notification, NotificationType, Task, ChatMessage } from '../types';
import { generateNewInspectionReport } from '../constants';

// --- Dexie Database Definition ---

export class QopikunDB extends Dexie {
    users!: Table<User, number>; // Primary key is number, auto-incrementing
    inspections!: Table<InspectionReport, string>; // Primary key is string (id)
    notifications!: Table<Notification, string>; // Primary key is string (id)
    tasks!: Table<Task, number>; // Primary key is number (id), auto-incremented
    chatMessages!: Table<ChatMessage, number>; // Primary key is number, auto-incremented

    constructor() {
        super('qopikun_db');
        
        // Define a single, correct version of the schema from the start.
        // This avoids complex and error-prone upgrade paths for a new database.
        // FIX: The .run() method was incorrectly chained after .stores(). Replaced with the standard on('populate') event for seeding.
        this.version(1).stores({
            users: '++id, &username', // Correctly define auto-incrementing primary key
            inspections: 'id, scheduledById',
            notifications: 'id, userId',
            tasks: '++id, userId',
            chatMessages: '++id, inspectionId, timestamp',
        });

        this.on('populate', async (tx) => {
            // Populate with default data only if the users table is empty.
            // This is a robust way to handle initial population.
            const userCount = await tx.table('users').count();
            if (userCount === 0) {
                console.log("Populating database with default data...");

                const defaultUsers: Omit<User, 'id'>[] = [
                    { username: 'admin', password: 'password', role: UserRole.ADMIN },
                    { username: 'inspector1', password: 'password', role: UserRole.INSPECTOR },
                    { username: 'supervisor1', password: 'password', role: UserRole.SUPERVISOR },
                    { username: 'inspector2', password: 'password', role: UserRole.INSPECTOR },
                ];

                await tx.table('users').bulkAdd(defaultUsers);

                // Now get the generated IDs to create related inspections
                const inspector1 = await tx.table('users').where('username').equals('inspector1').first();
                const inspector2 = await tx.table('users').where('username').equals('inspector2').first();

                if (inspector1 && inspector2) {
                    const defaultInspections: InspectionReport[] = [
                        generateNewInspectionReport('Sample Inspection for Turbine Blade', inspector1.id),
                        generateNewInspectionReport('FAI for Landing Gear Strut', inspector2.id),
                    ];
                    await tx.table('inspections').bulkAdd(defaultInspections);
                }
            }
        });
    }
}

export const db = new QopikunDB();

// --- API functions to interact with the database (now async) ---

export const authenticateUser = async (username: string, password: string): Promise<User | undefined> => {
    const user = await db.users.where('username').equals(username).first();
    if (user && user.password === password) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    return undefined;
};

export const createUser = async (username: string, password: string, role: UserRole): Promise<User | null> => {
    try {
        const newUser: Omit<User, 'id'> = {
            username,
            password,
            role,
        };
        const newId = await db.users.add(newUser as User);
        return { ...newUser, id: newId };
    } catch (e) {
        // This will catch constraint errors, like unique username violation
        console.error("Failed to create user:", e);
        return null; // Username already exists
    }
};

export const getUsers = async (): Promise<Omit<User, 'password'>[]> => {
    const allUsers = await db.users.toArray();
    return allUsers.map(({ password, ...user }) => user);
};

export const scheduleInspection = async (title: string, inspectorId: number): Promise<InspectionReport> => {
    const newInspection = generateNewInspectionReport(title, inspectorId);
    await db.inspections.add(newInspection);
    return newInspection;
};

export const getInspectionsForInspector = async (inspectorId: number): Promise<InspectionReport[]> => {
    return db.inspections.where('scheduledById').equals(inspectorId).reverse().toArray();
};

export const getAllInspections = async (): Promise<InspectionReport[]> => {
    return db.inspections.reverse().toArray();
};

export const getInspectionById = async (inspectionId: string): Promise<InspectionReport | undefined> => {
    const inspection = await db.inspections.get(inspectionId);
    // Return a deep copy to prevent direct mutation of the DB object from components
    return inspection ? JSON.parse(JSON.stringify(inspection)) : undefined;
};

export const updateInspection = async (report: InspectionReport): Promise<void> => {
    await db.inspections.put(report);
};

// --- Notification Functions ---

export const addNotification = async (userId: number, message: string, type: NotificationType, link?: string): Promise<Notification> => {
    const newNotification: Notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        message,
        type,
        link,
        timestamp: new Date().toISOString(),
        read: false,
    };
    await db.notifications.add(newNotification);
    return newNotification;
};

export const getNotificationsForUser = async (userId: number): Promise<Notification[]> => {
    return db.notifications.where('userId').equals(userId).reverse().toArray();
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await db.notifications.update(notificationId, { read: true });
};

export const markAllNotificationsAsRead = async (userId: number): Promise<void> => {
    await db.notifications.where({ userId, read: false }).modify({ read: true });
};

// --- Task Functions ---

export const getTasksForUser = async (userId: number): Promise<Task[]> => {
    return db.tasks.where({ userId }).toArray();
};

export const addTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    const id = await db.tasks.add(task as Task);
    return { ...task, id };
};

export const updateTask = async (id: number, changes: Partial<Task>): Promise<void> => {
    await db.tasks.update(id, changes);
};

export const deleteTask = async (id: number): Promise<void> => {
    await db.tasks.delete(id);
};

// --- Chat Functions ---

export const getChatMessagesForInspection = async (inspectionId: string): Promise<ChatMessage[]> => {
    return db.chatMessages.where({ inspectionId }).sortBy('timestamp');
};

export const addChatMessage = async (message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> => {
    const id = await db.chatMessages.add(message as ChatMessage);
    return { ...message, id };
};
export interface AudioNotification {
    userJoin: string;
    userLeave: string;
    messageNotification: string;
    error: string;
}

export type AudioEvents = 'userJoin' | 'userLeave' | 'messageNotification' | 'error';
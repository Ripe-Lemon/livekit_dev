// 文件路径: app/room/components/FloatingChat.tsx
// @/app/room/components/FloatingChat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { CustomChat } from './CustomChat'; // 导入模块化的聊天组件

/**
 * 悬浮聊天组件，管理聊天窗口的显示/隐藏和新消息通知。
 */
export function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const audioRef = useRef<{ play: () => void } | null>(null);

    // 创建新消息提示音
    useEffect(() => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const createNotificationSound = () => { /* ... 提示音逻辑 ... */ };
        audioRef.current = { play: createNotificationSound };
    }, []);

    // 监听全局的 newChatMessage 事件
    useEffect(() => {
        const handleNewMessage = () => {
            audioRef.current?.play();
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };
        window.addEventListener('newChatMessage', handleNewMessage);
        return () => window.removeEventListener('newChatMessage', handleNewMessage);
    }, [isOpen]);

    const handleToggleChat = () => {
        if (!isOpen) {
            setUnreadCount(0);
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            {/* 悬浮聊天面板 */}
            <div className={`fixed top-6 right-20 ... ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full rounded-lg bg-gray-900/95 ...">
                    {/* ... 头部和关闭按钮 ... */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* 渲染核心聊天组件 */}
                        <CustomChat />
                    </div>
                </div>
            </div>

            {/* 聊天按钮和未读消息气泡 */}
            <div className="fixed top-6 right-6 z-50">
                <button onClick={handleToggleChat} className="...">
                    {/* ... SVG Icon ... */}
                </button>
                {unreadCount > 0 && !isOpen && (
                    <div className="absolute -top-2 -right-2 ...">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                )}
            </div>
        </>
    );
}
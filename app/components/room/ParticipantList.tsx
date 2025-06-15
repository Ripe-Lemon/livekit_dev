'use client';

import React, { useState, useCallback } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Button } from '../ui/Button';

interface ParticipantListProps {
    onClose: () => void;
    className?: string;
}

export function ParticipantList({ onClose, className = '' }: ParticipantListProps) {
    // 安全地获取 room context
    let room: any;
    let participants: Participant[] = [];
    
    try {
        room = useRoomContext();
        participants = useParticipants();
    } catch (error) {
        console.warn('无法获取房间上下文，参与者列表将显示为空');
    }

    const [searchTerm, setSearchTerm] = useState('');

    // 过滤参与者
    const filteredParticipants = participants.filter(participant =>
        participant.identity.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleMuteParticipant = useCallback(async (participantSid: string) => {
        if (!room?.localParticipant) return;
        
        try {
            // 这里应该调用服务器API来静音参与者
            console.log('静音参与者:', participantSid);
        } catch (error) {
            console.error('静音参与者失败:', error);
        }
    }, [room]);

    const handleKickParticipant = useCallback(async (participantSid: string) => {
        if (!room?.localParticipant) return;
        
        try {
            // 这里应该调用服务器API来踢出参与者
            console.log('踢出参与者:', participantSid);
        } catch (error) {
            console.error('踢出参与者失败:', error);
        }
    }, [room]);

    return (
        <div className={`bg-gray-800 border-gray-700 ${className}`}>
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">
                    参与者 ({participants.length})
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </Button>
            </div>

            {/* 搜索框 */}
            <div className="p-4 border-b border-gray-700">
                <input
                    type="text"
                    placeholder="搜索参与者..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* 参与者列表 */}
            <div className="flex-1 overflow-y-auto">
                {!room ? (
                    <div className="p-4 text-center text-gray-400">
                        <p>无法连接到房间</p>
                    </div>
                ) : filteredParticipants.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">
                        <p>没有找到参与者</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-2">
                        {filteredParticipants.map((participant) => (
                            <div
                                key={participant.sid}
                                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    {/* 用户头像 */}
                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                                        {participant.identity.charAt(0).toUpperCase()}
                                    </div>
                                    
                                    <div>
                                        <p className="text-white font-medium">
                                            {participant.identity}
                                            {participant.isLocal && (
                                                <span className="ml-2 text-xs text-blue-400">(你)</span>
                                            )}
                                        </p>
                                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                                            {/* 麦克风状态 */}
                                            <span className={`flex items-center ${
                                                participant.isMicrophoneEnabled ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {participant.isMicrophoneEnabled ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v3a3 3 0 01-3 3h-1M4 10h16m-8-3v10" />
                                                    )}
                                                </svg>
                                                {participant.isMicrophoneEnabled ? '开启' : '关闭'}
                                            </span>
                                            
                                            {/* 摄像头状态 */}
                                            <span className={`flex items-center ${
                                                participant.isCameraEnabled ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {participant.isCameraEnabled ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                                    )}
                                                </svg>
                                                {participant.isCameraEnabled ? '开启' : '关闭'}
                                            </span>

                                            {/* 屏幕共享状态 */}
                                            {participant.isScreenShareEnabled && (
                                                <span className="flex items-center text-blue-400">
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                    共享屏幕
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 操作按钮 - 只有管理员才能看到 */}
                                {!participant.isLocal && room?.localParticipant && (
                                    <div className="flex items-center space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleMuteParticipant(participant.sid)}
                                            className="text-gray-400 hover:text-red-400"
                                            title="静音"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0V7a3 3 0 013-3h8a3 3 0 013 3v3a3 3 0 01-3 3h-1M4 10h16m-8-3v10" />
                                            </svg>
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleKickParticipant(participant.sid)}
                                            className="text-gray-400 hover:text-red-400"
                                            title="踢出"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
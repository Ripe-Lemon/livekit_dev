'use client';

import React, { useState, useCallback } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface ParticipantListProps {
    onClose: () => void;
    className?: string;
}

interface ParticipantItemProps {
    participant: any;
    isLocal: boolean;
    onAction?: (action: string, participantId: string) => void;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({ 
    participant, 
    isLocal, 
    onAction 
}) => {
    const [showActions, setShowActions] = useState(false);

    const isAudioEnabled = participant.isMicrophoneEnabled;
    const isVideoEnabled = participant.isCameraEnabled;
    const isScreenSharing = participant.isScreenShareEnabled;
    const isSpeaking = participant.isSpeaking;

    return (
        <div className={`p-3 rounded-lg border transition-colors ${
            isSpeaking 
                ? 'bg-blue-900/30 border-blue-600' 
                : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {/* 头像 */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        isSpeaking ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-600'
                    }`}>
                        {participant.identity.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-white font-medium">
                                {participant.identity}
                                {isLocal && <span className="text-gray-400 text-sm ml-1">(您)</span>}
                            </span>
                            
                            {/* 说话指示器 */}
                            {isSpeaking && (
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-green-400 text-xs">说话中</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-3 mt-1">
                            {/* 音频状态 */}
                            <div className={`flex items-center space-x-1 ${
                                isAudioEnabled ? 'text-green-400' : 'text-red-400'
                            }`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isAudioEnabled ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1.586l4.707-4.707C10.923 4.663 12 5.109 12 6v12c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    )}
                                </svg>
                                <span className="text-xs">{isAudioEnabled ? '麦克风开启' : '麦克风关闭'}</span>
                            </div>

                            {/* 视频状态 */}
                            <div className={`flex items-center space-x-1 ${
                                isVideoEnabled ? 'text-green-400' : 'text-red-400'
                            }`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isVideoEnabled ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 18M5.636 5.636L6 6" />
                                    )}
                                </svg>
                                <span className="text-xs">{isVideoEnabled ? '摄像头开启' : '摄像头关闭'}</span>
                            </div>

                            {/* 屏幕共享状态 */}
                            {isScreenSharing && (
                                <div className="flex items-center space-x-1 text-blue-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-xs">共享屏幕</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 操作按钮 */}
                {!isLocal && (
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowActions(!showActions)}
                            className="text-gray-400 hover:text-white"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </Button>

                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 w-32 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            onAction?.('mute', participant.identity);
                                            setShowActions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                                    >
                                        静音
                                    </button>
                                    <button
                                        onClick={() => {
                                            onAction?.('kick', participant.identity);
                                            setShowActions(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-gray-600 hover:text-red-200"
                                    >
                                        踢出
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ParticipantList: React.FC<ParticipantListProps> = ({ 
    onClose, 
    className = '' 
}) => {
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();
    const [loading, setLoading] = useState(false);

    const handleParticipantAction = useCallback(async (action: string, participantId: string) => {
        try {
            setLoading(true);
            
            switch (action) {
                case 'mute':
                    console.log(`静音参与者: ${participantId}`);
                    // 实现静音逻辑
                    break;
                case 'kick':
                    if (window.confirm(`确定要踢出 ${participantId} 吗？`)) {
                        console.log(`踢出参与者: ${participantId}`);
                        // 实现踢出逻辑
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error(`执行操作失败: ${action}`, error);
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <div className={`flex flex-col h-full bg-gray-800 ${className}`}>
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">参与者</h3>
                    <span className="text-sm text-gray-400">({participants.length})</span>
                </div>

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

            {/* 参与者列表 */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && (
                    <div className="flex justify-center py-4">
                        <LoadingSpinner size="sm" color="white" />
                    </div>
                )}

                <div className="space-y-3">
                    {participants.map((participant) => (
                        <ParticipantItem
                            key={participant.identity}
                            participant={participant}
                            isLocal={participant === localParticipant}
                            onAction={handleParticipantAction}
                        />
                    ))}
                </div>

                {participants.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <p className="text-lg font-medium mb-2">暂无参与者</p>
                        <p className="text-sm">等待其他人加入房间...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
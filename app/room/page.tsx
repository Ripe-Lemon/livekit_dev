// 文件路径: app/room/page.tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import {
    ControlBar,
    RoomAudioRenderer,
    RoomContext,
    LayoutContextProvider,
} from '@livekit/components-react';
import '@livekit/components-styles';

// 导入自定义 Hooks
import { useLiveKitConnection } from './hooks/useLiveKitConnection';
import { useAudioProcessing } from './hooks/useAudioProcessing';

// 导入模块化组件
import { RoomInfo } from './components/RoomInfo';
import { AudioProcessingControls } from './components/AudioProcessingControls';
import { MyVideoConference } from './components/MyVideoConference';
import { FloatingChat } from './components/FloatingChat';

// 导入项目内其他组件
import { MuteAllButton } from '@/app/room/hooks/MuteAllButton';
import { MyStatusEditor } from '@/app/room/hooks/MyStatusEditor';

/**
 * 房间页面的核心内容渲染组件
 */
function RoomPageContent() {
    const searchParams = useSearchParams();
    const roomName = searchParams.get('roomName');
    const participantName = searchParams.get('participantName');

    // 1. 使用 Hook 管理连接
    const { room, isLoading, error } = useLiveKitConnection(roomName, participantName);

    // 2. 使用 Hook 管理音频处理
    // (room不为null且!isLoading时，isConnected为true)
    const {
        isNoiseSuppressionEnabled,
        handleToggleNoiseSuppression,
        isEchoCancellationEnabled,
        handleToggleEchoCancellation
    } = useAudioProcessing(room, !isLoading && !error);


    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">正在连接房间...</div>;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-900">
                <p className="text-xl font-bold text-red-500">连接错误</p>
                <div className="text-lg text-gray-300">{error}</div>
                <Link href="/" className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-lg text-white shadow-sm hover:bg-blue-700">
                    返回大厅
                </Link>
            </div>
        );
    }

    // 确保 room 对象存在再渲染
    if (!room) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">初始化失败...</div>;
    }

    return (
        <RoomContext.Provider value={room}>
            <LayoutContextProvider>
                <div data-lk-theme="default" className="flex h-screen flex-col bg-gray-900">
                    <div className="flex-1 flex flex-col">
                        <MyVideoConference />
                        <RoomAudioRenderer />
                    </div>

                    {/* 统一的底部控制栏 */}
                    <div className="flex flex-col gap-3 p-4 bg-gray-900/80 backdrop-blur-sm">
                        <div className='max-w-md mx-auto w-full'>
                            <MyStatusEditor />
                        </div>

                        {/* 第一行：信息和高级控制 */}
                        <div className="flex items-center justify-between">
                            <RoomInfo />
                            <div className="flex items-center gap-2">
                                <MuteAllButton />
                                <AudioProcessingControls
                                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                                    onToggleEchoCancellation={handleToggleEchoCancellation}
                                />
                            </div>
                        </div>

                        {/* 第二行：主要控制按钮 */}
                        <div className="flex items-center justify-center gap-4">
                            <ControlBar />
                        </div>
                    </div>
                </div>

                <FloatingChat />
            </LayoutContextProvider>
        </RoomContext.Provider>
    );
}


/**
 * 页面入口组件
 */
export default function Page() {
    return (
        <div>
            {/* Suspense 用于在加载路由参数时显示回退UI */}
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">加载中...</div>}>
                <RoomPageContent />
            </Suspense>

            {/* 返回大厅的悬浮按钮 */}
            <Link
                href="/"
                className="fixed top-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-105"
                aria-label="返回大厅"
            >
                {/* ... SVG Icon ... */}
            </Link>
        </div>
    );
}
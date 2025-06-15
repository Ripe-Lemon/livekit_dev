import Link from 'next/link'; // 1. 导入 Link 组件用于客户端导航

export default function Home() {
  return (
      // 2. 使用 flex 布局让按钮在屏幕上垂直和水平居中
      <main className="flex min-h-screen flex-col items-center justify-center">
        {/* 3. 使用 Link 组件作为按钮。
           - href="/room" 指定了目标路径。
           - className 沿用了你项目中 Tailwind CSS 的样式，使其看起来像一个按钮。
      */}
        <Link
            href="/room"
            className="rounded-full bg-foreground px-8 py-4 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          进入房间
        </Link>
      </main>
  );
}
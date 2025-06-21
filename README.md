
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
## 此分支目的
- 用作新功能测试
- 迁移部分代码到跨平台应用（目标实现 Windows,Linux,Macos,Android 等多端运行）

## TO DO LIST
- [ ] 状态栏
- [ ] 不听🙉
- [ ] VAD
- [ ] 麦克风门限阈值调节
- [ ] 音量平衡
- [ ] 目前的图标是在代码里面的路径，之后改成SVG
- [ ] 移动端UI重新适配
- [x] 控制栏半透明
- [ ] 图片预览缩放与鼠标的绝对位置相关
- [ ] 图片预览与手机的适配
- [ ] 图片预览与触控板的适配
- [ ] 图片预览滚轮缩放时报错 Unable to preventDefault inside passive event listener invocation.

## 备忘录
- 音量平衡 https://docs.livekit.io/reference/components/react/hook/useismuted/
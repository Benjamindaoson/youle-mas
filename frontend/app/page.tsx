import { Messenger } from '@/components/messenger';

/** 默认入口 — 三列 IM 风格工作台，锁死两个群聊。
 *  V0 九角色 demo 仍保留在 /legacy；V1 主编排工作台在 /v1。 */
export default function Home() {
  return <Messenger />;
}

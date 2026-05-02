import { redirect } from 'next/navigation';

/** 默认入口：九宫格 + 群聊的旧版工作台。新版主编排工作台见 `/v1`。 */
export default function Home() {
  redirect('/legacy');
}

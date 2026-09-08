/**
 * 檔案：src/app/s/[examId]/page.tsx  →  /s/:examId
 * 角色：前端層 — 公開分享頁（免登入）
 * 功能：只有 exam_reports.shared = true 才顯示。畫面只有「結果卡片」
 *       （雷達 + 分級 + 分數 + 一句總評 + 品牌），**不含**陷阱對照、L5 示範、逐點回饋。
 *       generateMetadata 提供分享預覽文字；卡片圖由同目錄 opengraph-image 產生。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSharedCard } from '@/lib/exam-reports';
import { ResultCard } from '@/components/ResultCard';
import { AiCatMark } from '@/components/AiCatMark';

export const dynamic = 'force-dynamic'; // 依 DB 即時資料，不預先靜態化

type Params = { params: Promise<{ examId: string }> };

function mean(scores: Record<string, number>): number {
  const v = Object.values(scores);
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { examId } = await params;
  const card = await getSharedCard(examId);
  if (!card) return { title: 'AI-CAT 檢測結果' };
  const m = mean(card.scores);
  const title = `我的 AI 應用能力：${card.suggested_level}（AI SCORE ${m}）`;
  return {
    title: `${title}｜AI-CAT`,
    description: card.overall_summary,
    openGraph: {
      title,
      description: card.overall_summary,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description: card.overall_summary },
  };
}

export default async function SharePage({ params }: Params) {
  const { examId } = await params;
  const card = await getSharedCard(examId);
  if (!card) notFound();

  return (
    <main className="share-page">
      <header className="share-page-top">
        <Link href="/" className="topbar-brand" aria-label="AI-CAT 首頁">
          <AiCatMark size={18} />
          <span className="wordmark">AI-CAT</span>
        </Link>
        <span className="mono-label">AI COMPETENCY ASSESSMENT</span>
      </header>

      <ResultCard
        level={card.suggested_level}
        scores={card.scores}
        summary={card.overall_summary}
        orientation="portrait"
      />

      <p className="share-page-cta">
        這是一份 <strong>AI-CAT</strong> 的 AI 應用能力檢測結果。
        <Link href="/exam">換你測一次 →</Link>
      </p>
    </main>
  );
}

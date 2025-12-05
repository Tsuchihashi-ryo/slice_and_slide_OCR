
import React from 'react';

interface ReadmeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReadmeModal: React.FC<ReadmeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto relative flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-slate-800">使い方 (User Guide)</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-8 text-slate-700 leading-relaxed">
          
          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
              アップロード
            </h3>
            <ul className="list-disc list-inside ml-2 space-y-2 text-slate-600">
              <li><strong>ドラッグ＆ドロップ</strong>: 画像 (JPG, PNG, WEBP) または PDF ファイルをアップロードエリアにドラッグします。</li>
              <li><strong>貼り付け</strong>: クリップボードから画像を直接 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">Ctrl+V</code> (または <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">Cmd+V</code>) で貼り付けます。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
              レイアウトの分析と編集
            </h3>
            <p className="mb-3">アプリは自動的にコンテンツブロックを検出します。</p>
            <div className="flex gap-4 mb-4">
              <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded border border-blue-200 text-sm font-bold">青: テキスト</div>
              <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded border border-orange-200 text-sm font-bold">オレンジ: 画像</div>
            </div>
            
            <div className="space-y-4">
              <div>
                <strong className="text-slate-900 block mb-1">検出感度 (Detection Sensitivity)</strong>
                <p className="text-sm">サイドバーのスライダーを使用して、レイアウトの粒度を調整します。値を小さくすると細かい詳細が検出され、大きくすると要素がグループ化されます。</p>
              </div>
              <div>
                <strong className="text-slate-900 block mb-1">ブロックタイプの変更</strong>
                <p className="text-sm">ブロックをクリックし、「Switch to...」ボタンをクリックして、テキストモードと画像モードを切り替えます。</p>
              </div>
              <div>
                <strong className="text-slate-900 block mb-1">ブロックの結合 (Merge Blocks)</strong>
                <p className="text-sm">キャンバス上でドラッグして複数のブロックを選択し、「Merge Blocks」をクリックして1つの画像ブロックに結合します。</p>
              </div>
              <div>
                <strong className="text-slate-900 block mb-1">背景の保持 (Preserve Background)</strong>
                <p className="text-sm">図形や図表を含むテキストブロック（例：矢印の中のテキスト）の場合、ブロックを選択して <strong>"Keep Background Image"</strong> をチェックします。これにより、PowerPoint 上で編集可能なテキストの後ろに元の画像が表示されます。</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
              テキスト認識 (OCR)
            </h3>
            <p>サイドバーの <strong>"Detect Text (OCR)"</strong> ボタンをクリックします。アプリはブラウザ内でテキストを抽出します。<br/><span className="text-sm text-slate-500 italic">※ 出力時にテキストを編集可能にする場合は、この手順が必須です。</span></p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
              エクスポート
            </h3>
            <p>ドロップダウンから希望の <strong>フォントファミリー</strong> を選択し、<strong>"Export to PPTX"</strong> をクリックしてファイルをダウンロードします。</p>
          </section>

        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

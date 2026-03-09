import React from 'react';
import { useGameStore } from '../store';
import { getTranslation } from '../i18n';

export function PauseMenu() {
  const gameState = useGameStore(state => state.gameState);
  const togglePause = useGameStore(state => state.togglePause);
  const resetGame = useGameStore(state => state.resetGame);
  const setGameState = useGameStore(state => state.setGameState);
  const language = useGameStore(state => state.language);

  if (gameState !== 'paused') return null;

  const t = (key: any) => getTranslation(language, key);
  const isRTL = language === 'he';

  return (
    <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 ${isRTL ? 'dir-rtl' : 'dir-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-gray-900/90 p-8 rounded-2xl border border-white/10 text-white w-72 text-center shadow-2xl">
        <h2 className="text-3xl font-bold mb-8 tracking-wider">{isRTL ? 'מושהה' : 'PAUSED'}</h2>
        <div className="flex flex-col gap-4">
          <button onClick={togglePause} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20">{t('resume')}</button>
          <button onClick={() => { resetGame(); setGameState('playing'); }} className="bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-all">{t('restart')}</button>
          <button onClick={() => setGameState('menu')} className="bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl font-bold transition-all">{t('mainMenu')}</button>
        </div>
      </div>
    </div>
  );
}

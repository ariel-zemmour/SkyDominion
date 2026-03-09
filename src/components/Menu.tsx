import React, { useState, useEffect } from 'react';
import { useGameStore, JETS, KeyMapping } from '../store';
import { Plane, Play, Settings, Trophy, Globe, ArrowLeft, ShoppingCart, Keyboard } from 'lucide-react';
import { getTranslation } from '../i18n';
import { audioSynth } from '../audio';

export function Menu() {
  const gameState = useGameStore(state => state.gameState);
  const setGameState = useGameStore(state => state.setGameState);
  const resetGame = useGameStore(state => state.resetGame);
  const score = useGameStore(state => state.score);
  const language = useGameStore(state => state.language);
  const setLanguage = useGameStore(state => state.setLanguage);
  const trophies = useGameStore(state => state.trophies);
  const purchasedJets = useGameStore(state => state.purchasedJets);
  const activeJet = useGameStore(state => state.activeJet);
  const buyJet = useGameStore(state => state.buyJet);
  const setActiveJet = useGameStore(state => state.setActiveJet);
  const keyMap = useGameStore(state => state.keyMap);
  const setKeyMap = useGameStore(state => state.setKeyMap);
  const completionPercentage = useGameStore(state => state.completionPercentage);
  const mission = useGameStore(state => state.mission);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [rebindingKey, setRebindingKey] = useState<keyof KeyMapping | null>(null);

  useEffect(() => {
    if (!rebindingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const newKey = e.code;
      
      // Check for conflicts
      const isConflict = Object.entries(keyMap).some(([action, key]) => key === newKey && action !== rebindingKey);
      
      if (isConflict) {
        alert('Key already in use!');
      } else {
        setKeyMap({ ...keyMap, [rebindingKey]: newKey });
      }
      setRebindingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rebindingKey, keyMap, setKeyMap]);

  if (gameState === 'playing') return null;

  const handleStart = () => {
    audioSynth.init();
    resetGame();
  };

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);
  const isRTL = language === 'he';

  return (
    <div className={`absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white font-sans z-50 ${isRTL ? 'dir-rtl' : 'dir-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`${showShop ? 'max-w-2xl' : 'max-w-md'} w-full p-8 rounded-2xl border border-white/10 bg-white/5 shadow-2xl transition-all duration-300`}>
        <div className="flex justify-center mb-6">
          <Plane size={64} className="text-blue-500" />
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-2 tracking-tight">ACE STRIKE</h1>
        <p className="text-center text-white/50 mb-8">{t('browserSimulator')}</p>

        {showSettings ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <ArrowLeft size={24} className={isRTL ? 'rotate-180' : ''} />
              </button>
              <h2 className="text-2xl font-bold">{t('settings')}</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <Globe size={20} className="text-blue-400" />
                  <h3 className="font-bold">{t('language')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setLanguage('en')} className={`py-2 px-4 rounded-lg font-medium transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}>English</button>
                  <button onClick={() => setLanguage('he')} className={`py-2 px-4 rounded-lg font-medium transition-colors ${language === 'he' ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}>עברית</button>
                </div>
              </div>
              
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <Settings size={20} className="text-blue-400" />
                  <h3 className="font-bold">{t('volume')}</h3>
                </div>
                <input type="range" min="0" max="1" step="0.1" value={useGameStore.getState().settings.volume} onChange={(e) => { const vol = parseFloat(e.target.value); useGameStore.getState().setVolume(vol); audioSynth.setVolume(vol); }} className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        ) : showShop ? (
          <div className="space-y-6 flex flex-col h-[70vh]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowShop(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <ArrowLeft size={24} className={isRTL ? 'rotate-180' : ''} />
                </button>
                <h2 className="text-2xl font-bold">{isRTL ? 'חנות' : 'Shop'}</h2>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
                <Trophy size={16} className="text-yellow-500" />
                <span className="font-bold text-yellow-500">{trophies}</span>
              </div>
            </div>
            
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {JETS.map(jet => {
                const isSelected = activeJet === jet.id;
                const isBought = purchasedJets.includes(jet.id);
                const canAfford = trophies >= jet.cost;
                
                return (
                  <div key={jet.id} className={`bg-white/5 p-4 rounded-xl border transition-all ${isSelected ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:bg-white/10'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: jet.color }}>
                          <Plane size={24} className="text-white mix-blend-difference" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{jet.name}</h3>
                          <div className="flex items-center gap-2">
                             {!isBought && (
                               <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                                 <Trophy size={14} />
                                 {jet.cost}
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                      
                      {isBought ? (
                        <button 
                          onClick={() => setActiveJet(jet.id)}
                          className={`py-2 px-6 rounded-lg font-bold transition-all ${isSelected ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}
                        >
                          {isSelected ? (isRTL ? 'פעיל' : 'Active') : (isRTL ? 'בחר' : 'Select')}
                        </button>
                      ) : (
                        <button 
                          onClick={() => buyJet(jet.id)}
                          disabled={!canAfford}
                          className={`py-2 px-6 rounded-lg font-bold transition-all ${canAfford ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                        >
                          {isRTL ? 'קנה' : 'Buy'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/40 uppercase font-bold">{t('speed')}</div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min((jet.speed / 2200) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/40 uppercase font-bold">{t('health')}</div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${Math.min((jet.armor / 400) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/40 uppercase font-bold">{isRTL ? 'נשק' : 'Weapon'}</div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500" style={{ width: `${Math.min((jet.weapons / 6) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : showControls ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setShowControls(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <ArrowLeft size={24} className={isRTL ? 'rotate-180' : ''} />
              </button>
              <h2 className="text-2xl font-bold">{t('controls')}</h2>
            </div>
            
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(keyMap).map(([action, key]) => (
                <div key={action} className="bg-white/5 p-3 rounded-lg border border-white/10 flex justify-between items-center">
                  <span className="capitalize">{t(action as any) || action}</span>
                  <button 
                    onClick={() => setRebindingKey(action as keyof KeyMapping)}
                    className={`py-1 px-3 rounded text-sm font-mono ${rebindingKey === action ? 'bg-yellow-600' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    {rebindingKey === action ? t('pressKey') : key}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {gameState === 'gameover' && (
              <div className="mb-8 text-center bg-red-500/20 p-4 rounded-xl border border-red-500/30">
                <h2 className="text-xl font-bold text-red-400 mb-2">{t('missionFailed')}</h2>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 text-2xl">
                    <Trophy size={24} className="text-yellow-500" />
                    <span>{t('missionCompletion')}: {completionPercentage}%</span>
                  </div>
                  <div className="text-sm text-white/50">{t('score')}: {score}</div>
                </div>
              </div>
            )}

            {completionPercentage > 0 && gameState === 'menu' && !showShop && !showSettings && !showControls && (
              <div className="mb-8 text-center bg-green-500/20 p-4 rounded-xl border border-green-500/30">
                <h2 className="text-xl font-bold text-green-400 mb-2">{t('missionComplete')}</h2>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 text-3xl font-mono text-green-500">
                    <span>{completionPercentage}%</span>
                  </div>
                  <div className="text-sm text-white/50">{t('score')}: {score}</div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button onClick={handleStart} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                <Play size={24} className={isRTL ? 'rotate-180' : ''} />
                {gameState === 'gameover' ? t('restart') : t('startGame')}
              </button>
              
              <button onClick={() => setShowSettings(true)} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                <Settings size={24} />
                {t('settings')}
              </button>
              
              <button onClick={() => setShowShop(true)} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                <ShoppingCart size={24} />
                {isRTL ? 'חנות' : 'Shop'}
              </button>
              
              <button onClick={() => setShowControls(true)} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                <Keyboard size={24} />
                {t('controls')}
              </button>
              
              <button onClick={() => window.close()} className="w-full py-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                {t('exit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

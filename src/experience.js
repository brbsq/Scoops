// One owner for the shared scenery prevents a late model load from reopening it over a menu.
export function createExperience(load) {
  let scene, pending, gameVisible = false;
  function prepare() {
    pending ||= load().then(async module => {
      scene = module;
      await scene.prepareShop();
      scene.setShopVisible(gameVisible);
      return scene;
    }).catch(error => { console.warn('Keeping the wave background.', error); return null; });
    return pending;
  }
  return {
    prepare,
    showGame() { gameVisible = true; if (scene) scene.setShopVisible(true); else void prepare(); },
    showMenu() { gameVisible = false; scene?.setShopVisible(false); },
  };
}
export const experience = createExperience(() => import('./shop-scene.js'));

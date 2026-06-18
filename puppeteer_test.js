const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
    });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });
    
    page.on('pageerror', err => {
        console.log('[PAGE ERROR]', err.toString());
    });
    
    await page.goto('http://127.0.0.1:8080/index.html', {waitUntil: 'networkidle0'});
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Evaluate in page
    await page.evaluate(() => {
        if (window.game) {
            window.game.start();
            
            // Mock pointer lock
            window.game.input.isPointerLocked = () => true;
            
            // simulate holding W key
            window.game.input.keys.forward = true;
            
            setInterval(() => {
                if (window.game.player) {
                    console.log(`[STATE] Pos: y=${window.game.player.position.y.toFixed(2)}, eyeY=${window.game.engine.camera.position.y.toFixed(2)}, dt=${window.game.lastTime}, fps=${window.game.fps}`);
                    
                    const renderer = window.game.engine.renderer;
                    if (renderer) {
                        console.log(`[RENDERER] calls=${renderer.info.render.calls}, triangles=${renderer.info.render.triangles}`);
                    }
                }
            }, 1000);
        } else {
            console.log('[ERROR] Game is undefined!');
        }
    });
    
    await new Promise(r => setTimeout(r, 8000));
    await browser.close();
})();

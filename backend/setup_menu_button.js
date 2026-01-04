// Script to configure Telegram Bot Menu Button
// Run this once to set up the menu button for fullscreen mode

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const MENU_BUTTON_URL = 'https://hello-world-app-dusky.vercel.app/';

async function setMenuButton() {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`;

    const payload = {
        menu_button: {
            type: 'web_app',
            text: 'Сплести Узор',
            web_app: {
                url: MENU_BUTTON_URL
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.ok) {
            console.log('✅ Menu button configured successfully!');
            console.log('Menu button will now open in fullscreen mode');
        } else {
            console.error('❌ Failed to configure menu button:', data);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the function
setMenuButton();

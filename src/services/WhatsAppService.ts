import axios from 'axios';

class WhatsAppService {
  private apiUrl: string;
  private phoneNumber: string;
  private apiKey: string;
  private enabled: boolean;

  constructor() {
    this.apiUrl = 'https://api.callmebot.com/whatsapp.php';
    this.phoneNumber = process.env.CALLMEBOT_PHONE || '';
    this.apiKey = process.env.CALLMEBOT_API_KEY || '';
    
    this.enabled = !!(this.phoneNumber && this.apiKey);
    
    if (!this.enabled) {
      console.log('WhatsApp Service disabled: CALLMEBOT_PHONE or CALLMEBOT_API_KEY not set in .env');
    }
  }

  private async sendMessage(text: string) {
    if (!this.enabled) return;

    try {
      const url = `${this.apiUrl}?phone=${this.phoneNumber}&text=${encodeURIComponent(text)}&apikey=${this.apiKey}`;
      await axios.get(url);
      console.log(`WhatsApp Alert sent: ${text}`);
    } catch (error) {
      console.error('Failed to send WhatsApp message via CallMeBot', error);
    }
  }

  async sendStreamStartedAlert(channelName: string, imageName: string) {
    const text = `🟢 *Stream Started*\nChannel: ${channelName}\nImage: ${imageName}\nTime: ${new Date().toLocaleString()}`;
    await this.sendMessage(text);
  }

  async sendStreamStoppedAlert(channelName: string, imageName: string) {
    const text = `🔴 *Stream Stopped*\nChannel: ${channelName}\nImage: ${imageName}\nTime: ${new Date().toLocaleString()}`;
    await this.sendMessage(text);
  }

  async sendStreamCrashedAlert(channelName: string, imageName: string, code: number | null) {
    const text = `⚠️ *Stream Crashed!* Auto-restarting...\nChannel: ${channelName}\nImage: ${imageName}\nExit Code: ${code}\nTime: ${new Date().toLocaleString()}`;
    await this.sendMessage(text);
  }
}

export const whatsappService = new WhatsAppService();

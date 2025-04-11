const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 環境変数を読み込み
dotenv.config();

// 本番環境または開発環境のホスト名を取得
const host = process.env.HOST_URL || 'localhost:3000';
const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
const url = `${protocol}://${host}/play`;

// QRコードの保存先ディレクトリ
const outputDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`QRコードを生成します: URL=${url}`);

// QRコードを生成して保存
QRCode.toFile(
  path.join(outputDir, 'qr-code.png'),
  url,
  {
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    width: 300,
    margin: 1
  },
  (err) => {
    if (err) {
      console.error('QRコードの生成に失敗しました:', err);
      process.exit(1); // エラー終了
    } else {
      console.log('QRコードが生成されました！');
      console.log('保存場所:', path.join(outputDir, 'qr-code.png'));
      console.log('QRコードURL:', url);
    }
  }
);
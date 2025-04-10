#!/bin/bash

# 必要なパッケージをインストール
echo "必要なパッケージをインストールしています..."
npm install

# QRコードを生成
echo "QRコードを生成しています..."
node generate-qrcode.js

# アプリを起動
echo "アプリを起動しています..."
echo "アプリを起動したら以下のURLにアクセスしてください:"
echo "メイン表示画面: http://localhost:3000/display"
echo "管理画面: http://localhost:3000/admin"
echo "参加者画面: http://localhost:3000/play"

npm start

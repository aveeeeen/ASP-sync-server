// server.js

import WebSocket, {WebSocketServer} from 'ws';
import * as http from 'node:http' // HTTPサーバーも必要（WebSocketはHTTPプロトコル上で動くため）
import express from 'express'; // コントローラーのホスティングのためにExpressを使用

const PORT = 8080; // サーバーがリッスンするポート番号
const APPPORT = 3000; // Expressアプリケーションのポート番号
const HOST = '0.0.0.0'

// HTTPサーバーを作成
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Server is running.\n');
});

// WebSocketサーバーをHTTPサーバーにアタッチ
const wss = new WebSocketServer({ server });

console.log(`WebSocketサーバーをポート ${PORT} で起動中...`);

// 接続されたクライアントの管理
const clients = new Set();

let effectId = 0;

wss.on('connection', (ws) => {
    console.log('新しいクライアントが接続しました。');
    clients.add(ws); // 新しいクライアントをセットに追加

    // クライアントからメッセージを受信した場合
    ws.on('message', (message) => {
        console.log(`クライアントからメッセージを受信: ${message}`);
        try {
            message = JSON.parse(message); // 受信したメッセージをJSONとしてパース
        } catch (error) {
            console.error('メッセージのパースに失敗:', error);
            return; // パースに失敗した場合は処理を中断
        }
        // 必要に応じて、受信したメッセージに応じて何か処理を行う
        if( message.action === 'selectEffect') {
            effectId = message.effectId; // 受信したエフェクトIDを保存
            console.log(`選択されたエフェクトID: ${effectId}`);
        }
    });

    // クライアントが切断した場合
    ws.on('close', () => {
        console.log('クライアントが切断しました。');
        clients.delete(ws); // 切断したクライアントをセットから削除
    });

    // エラーが発生した場合
    ws.on('error', (error) => {
        console.error('WebSocketエラーが発生しました:', error);
    });

    // 接続時にウェルカムメッセージを送信（任意）
    ws.send(JSON.stringify({ type: 'welcome', message: 'AR同期サーバーへようこそ！' }));
});

// --- メッセージ配信ロジック ---

let messageCounter = 0;

// 一定間隔でメッセージをブロードキャストする関数
const broadcastMessage = () => {
    messageCounter++;
    const currentTime = Date.now(); // 現在のUnixタイムスタンプ (ミリ秒)

    // 送信するキューデータ
    const cueData = {
        cueId: `cue_${String(messageCounter).padStart(3, '0')}`,
        currentTimestamp: currentTime,
        targetTimestamp: currentTime + 1000, // 現在時刻から500ミリ秒後に実行してほしい
        effectId: effectId,
        parameters: {
            color: messageCounter % 3 === 0 ? '#FF0000' : (messageCounter % 3 === 1 ? '#00FF00' : '#0000FF'),
            duration: 1000 // エフェクト表示時間 (ミリ秒)
        }
    };

    const messageToSend = JSON.stringify(cueData);

    console.log(`[${new Date().toLocaleTimeString()}] ${messageCounter}番目のキューを送信中 (対象時刻: ${cueData.targetTimestamp})...`);

    // 全ての接続済みクライアントにメッセージをブロードキャスト
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageToSend);
        }
    });
};

// 5秒ごとにメッセージをブロードキャスト
const broadcastInterval = 5000; // ミリ秒
setInterval(broadcastMessage, broadcastInterval);

// HTTPサーバーを起動
server.listen(PORT, HOST, () => {
    console.log(`HTTPサーバーもポート ${PORT} で起動しました。`);
});

// Expressアプリケーションを作成
const app = express();
// フロントエンドの静的ファイルを提供
app.use(express.static('public'));
// Expressアプリケーションを起動   
app.listen(APPPORT, () => {
    console.log(`
    Expressアプリケーションをポート ${APPPORT} で起動しました。
    フロントエンドは http://localhost:${APPPORT} でアクセスできます。
    `);
});
// Firebase 配置
var firebaseConfig = {
    apiKey: "AIzaSyCZijBiCDp6HWCQQlI8Y2Xaf5ve4r2-6oA",
    authDomain: "snakegame-df627.firebaseapp.com",
    databaseURL: "https://snakegame-df627-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "snakegame-df627",
    storageBucket: "snakegame-df627.firebasestorage.app",
    messagingSenderId: "1080130902246",
    appId: "1:1080130902246:web:03a9ecbfde885967a48327",
    measurementId: "G-8FGH164PS3"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var realtimeDb = firebase.database();

// 初始化完成标志
var firebaseInitialized = false;

// 监听 Firestore 初始化完成
db.settings({ timestampsInSnapshots: true });
console.log('Firebase 初始化完成');
firebaseInitialized = true;

// 全局变量
var currentGameId = null;
var currentPlayer = null;
var isOnlineMode = false;

// 保存分数到云端
window.saveScore = function(playerName, score, gameMode) {
    console.log('saveScore 被调用:', playerName, score, gameMode);
    
    if (!db) {
        console.error('Firestore 未初始化');
        alert('数据库连接失败，无法保存分数');
        return;
    }
    
    db.collection("scores").add({
        playerName: playerName || "匿名玩家",
        score: score,
        gameMode: gameMode,
        createdAt: new Date()
    }).then(function(docRef) {
        console.log("分数保存成功！文档ID:", docRef.id);
        // 弹窗A：提示数据已录入数据库与排行榜
        showSaveSuccessPopup(playerName, score, gameMode);
    }).catch(function(error) {
        console.error("保存失败:", error);
        alert('保存失败: ' + error.message);
    });
}

// 显示保存成功弹窗
function showSaveSuccessPopup(playerName, score, gameMode) {
    // 创建弹窗容器
    var popup = document.createElement('div');
    popup.id = 'saveSuccessPopup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #4ade80;
        border-radius: 16px;
        padding: 30px 40px;
        box-shadow: 0 10px 40px rgba(74, 222, 128, 0.3);
        z-index: 1000;
        text-align: center;
        min-width: 300px;
        animation: popupIn 0.3s ease-out;
    `;
    
    // 创建弹窗内容
    popup.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
        <h2 style="color: #4ade80; font-size: 24px; margin-bottom: 10px; font-weight: bold;">数据已录入！</h2>
        <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 8px;">玩家：${playerName || '匿名玩家'}</p>
        <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 8px;">分数：${score} 分</p>
        <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 20px;">模式：${gameMode === 'easy' ? '简单模式' : '困难模式'}</p>
        <button id="popupCloseBtn" style="
            background: linear-gradient(135deg, #4ade80, #22c55e);
            border: none;
            color: #1a1a2e;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        ">
            确定
        </button>
    `;
    
    // 创建遮罩层
    var overlay = document.createElement('div');
    overlay.id = 'popupOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999;
        animation: fadeIn 0.3s ease-out;
    `;
    
    // 添加动画样式
    var style = document.createElement('style');
    style.textContent = `
        @keyframes popupIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // 关闭按钮事件
    document.getElementById('popupCloseBtn').addEventListener('click', function() {
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', function() {
        document.body.removeChild(popup);
        document.body.removeChild(overlay);
    });
}

// 获取排行榜（支持模式筛选）
window.getLeaderboard = function(gameMode, callback) {
    console.log('getLeaderboard 被调用, 模式:', gameMode);
    
    // 检查 Firebase 是否初始化
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK 未加载');
        callback([]);
        return;
    }
    
    if (!db) {
        console.error('Firebase Firestore 未初始化');
        // 尝试重新初始化
        try {
            db = firebase.firestore();
            console.log('Firestore 重新初始化成功');
        } catch (e) {
            console.error('Firestore 重新初始化失败:', e);
            callback([]);
            return;
        }
    }
    
    console.log('开始查询 Firestore...');
    
    // 先不排序查询，避免索引问题
    db.collection("scores").limit(50).get()
        .then(function(querySnapshot) {
            console.log('查询成功, 文档数量:', querySnapshot.size);
            var leaderboard = [];
            querySnapshot.forEach(function(doc) {
                var data = doc.data();
                console.log('文档数据:', data);
                
                // 获取游戏模式字段（支持多种命名方式）
                var docMode = data.gameMode || data.gamemode || data.mode || 'unknown';
                var playerName = data.playerName || data.name || data.username || '匿名玩家';
                var score = data.score || data.points || data.scoreValue || 0;
                
                // 打印字段用于调试
                console.log('  - gameMode:', docMode, ', playerName:', playerName, ', score:', score);
                
                // 如果没有指定模式或者模式匹配，则添加到列表
                if (!gameMode || gameMode === 'all' || docMode === gameMode || 
                    docMode.toLowerCase() === gameMode.toLowerCase()) {
                    leaderboard.push({
                        id: doc.id,
                        playerName: playerName,
                        score: score,
                        gameMode: docMode
                    });
                    console.log('  ✓ 添加到列表');
                } else {
                    console.log('  ✗ 模式不匹配:', docMode, 'vs', gameMode);
                }
            });
            
            // 手动按分数排序
            leaderboard.sort(function(a, b) { return b.score - a.score; });
            
            // 限制返回数量
            leaderboard = leaderboard.slice(0, 20);
            
            console.log('筛选后数据:', leaderboard);
            callback(leaderboard);
        }).catch(function(error) {
            console.error("获取排行榜失败:", error);
            console.error("错误代码:", error.code);
            console.error("错误信息:", error.message);
            callback([]);
        });
}

// 创建房间
window.createRoom = function(playerName) {
    return new Promise(function(resolve, reject) {
        var gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        realtimeDb.ref('games/' + gameId).set({
            id: gameId,
            state: 'waiting',
            players: {
                p1: {
                    name: playerName,
                    ready: false
                }
            },
            scores: { p1: 0, p2: 0 }
        }).then(function() {
            currentGameId = gameId;
            currentPlayer = 'p1';
            isOnlineMode = true;
            resolve({ gameId: gameId, player: 'p1' });
        }).catch(function(error) {
            reject(error);
        });
    });
}

// 加入房间
window.joinRoom = function(gameId, playerName) {
    return new Promise(function(resolve, reject) {
        realtimeDb.ref('games/' + gameId).once('value').then(function(snapshot) {
            var gameData = snapshot.val();
            
            if (!gameData) {
                reject('房间不存在');
                return;
            }
            
            if (gameData.state !== 'waiting') {
                reject('房间已满或游戏已开始');
                return;
            }
            
            realtimeDb.ref('games/' + gameId).update({
                state: 'ready',
                players: {
                    p1: gameData.players.p1,
                    p2: {
                        name: playerName,
                        ready: false
                    }
                }
            }).then(function() {
                currentGameId = gameId;
                currentPlayer = 'p2';
                isOnlineMode = true;
                resolve({ gameId: gameId, player: 'p2' });
            }).catch(function(error) {
                reject(error);
            });
        }).catch(function(error) {
            reject(error);
        });
    });
}

// 设置玩家就绪状态
window.setReady = function(ready) {
    console.log('setReady 被调用 - ready:', ready, 'currentGameId:', currentGameId, 'currentPlayer:', currentPlayer);
    
    if (!currentGameId) {
        console.error('setReady 失败: currentGameId 为空');
        return;
    }
    if (!currentPlayer) {
        console.error('setReady 失败: currentPlayer 为空');
        return;
    }
    
    var path = 'games/' + currentGameId + '/players/' + currentPlayer + '/ready';
    console.log('设置 ready 状态到路径:', path);
    realtimeDb.ref(path).set(ready).then(function() {
        console.log('ready 状态设置成功!');
    }).catch(function(error) {
        console.error('ready 状态设置失败:', error);
    });
}

// 发送玩家移动
window.sendPlayerMove = function(direction) {
    console.log('sendPlayerMove 被调用 - direction:', direction, 'currentGameId:', currentGameId, 'currentPlayer:', currentPlayer);
    
    if (!currentGameId) {
        console.error('发送方向失败: currentGameId 为空');
        return;
    }
    if (!currentPlayer) {
        console.error('发送方向失败: currentPlayer 为空');
        return;
    }
    
    var snakeNum = currentPlayer === 'p1' ? '1' : '2';
    var path = 'games/' + currentGameId + '/snake' + snakeNum + '/direction';
    console.log('发送方向到路径:', path);
    
    realtimeDb.ref(path).set(direction, function(error) {
        if (error) {
            console.error('发送方向失败:', error);
        } else {
            console.log('方向发送成功!');
        }
    });
}

// 监听游戏状态
window.listenToGame = function(gameId, callback) {
    realtimeDb.ref('games/' + gameId).on('value', function(snapshot) {
        var gameData = snapshot.val();
        if (gameData) {
            callback(gameData);
        }
    });
}

// 获取房间列表
window.getRooms = function(callback) {
    realtimeDb.ref('games').orderByChild('state').equalTo('waiting').once('value').then(function(snapshot) {
        var rooms = [];
        snapshot.forEach(function(childSnapshot) {
            rooms.push({
                id: childSnapshot.key,
                players: childSnapshot.val().players || {}
            });
        });
        callback(rooms);
    }).catch(function(error) {
        console.error('获取房间列表失败:', error);
        callback([]);
    });
}

// 离开房间
window.leaveRoom = function() {
    if (!currentGameId) return;
    
    realtimeDb.ref('games/' + currentGameId).once('value').then(function(snapshot) {
        var gameData = snapshot.val();
        
        if (gameData && gameData.state !== 'ended') {
            if (currentPlayer === 'p1') {
                realtimeDb.ref('games/' + currentGameId).update({
                    state: 'ended',
                    winner: gameData.players.p2 ? 'p2' : null
                });
            } else {
                realtimeDb.ref('games/' + currentGameId).update({
                    state: 'ended',
                    winner: 'p1'
                });
            }
        }
        
        setTimeout(function() {
            realtimeDb.ref('games/' + currentGameId).remove();
        }, 5000);
    });
    
    currentGameId = null;
    currentPlayer = null;
    isOnlineMode = false;
    
    window.location.href = 'index.html';
}

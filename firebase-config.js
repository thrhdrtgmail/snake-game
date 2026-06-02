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

// 全局变量
var currentGameId = null;
var currentPlayer = null;
var isOnlineMode = false;

// 保存分数到云端
window.saveScore = function(playerName, score, gameMode) {
    db.collection("scores").add({
        playerName: playerName || "匿名玩家",
        score: score,
        gameMode: gameMode,
        createdAt: new Date()
    }).then(function(docRef) {
        console.log("分数保存成功！");
    }).catch(function(error) {
        console.error("保存失败:", error);
    });
}

// 获取排行榜（支持模式筛选）
window.getLeaderboard = function(gameMode, callback) {
    console.log('getLeaderboard 被调用, 模式:', gameMode);
    if (!db) {
        console.error('Firebase Firestore 未初始化');
        callback([]);
        return;
    }
    
    db.collection("scores").orderBy("score", "desc").limit(20).get()
        .then(function(querySnapshot) {
            console.log('查询成功, 文档数量:', querySnapshot.size);
            var leaderboard = [];
            querySnapshot.forEach(function(doc) {
                var data = doc.data();
                console.log('文档数据:', data);
                if (!gameMode || gameMode === 'all' || data.gameMode === gameMode) {
                    leaderboard.push({
                        id: doc.id,
                        playerName: data.playerName,
                        score: data.score,
                        gameMode: data.gameMode
                    });
                }
            });
            console.log('筛选后数据:', leaderboard);
            callback(leaderboard);
        }).catch(function(error) {
            console.error("获取排行榜失败:", error);
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
    if (!currentGameId || !currentPlayer) return;
    
    var path = 'games/' + currentGameId + '/players/' + currentPlayer + '/ready';
    realtimeDb.ref(path).set(ready);
}

// 发送玩家移动
window.sendPlayerMove = function(direction) {
    if (!currentGameId || !currentPlayer) return;
    
    var path = 'games/' + currentGameId + '/snake' + (currentPlayer === 'p1' ? '1' : '2') + '/direction';
    realtimeDb.ref(path).set(direction, function(error) {
        if (error) {
            console.error('发送方向失败:', error);
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

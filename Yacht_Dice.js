const { MessageEmbed } = require('discord.js');
const setting = require('./setting.json');
const token = setting.token;
const accChannelid = setting.accChannelID;//允許的頻道ID
const savetype = setting.savetype;//資料儲存模式 ram = 僅存於記憶體(default), json = 存檔於JSON中
const moneyunit = setting.moneyunit;//金錢單位 ex:元,G,個硬幣,根蘿蔔 之類的詞 設定成奇怪的東西可能會出事
const keyword = setting.keyword;//邀請遊戲關鍵字
let player = {};//玩家資料 playing=是否在遊戲中 matching=是否在配對中 match=對手的ID reply=是否等待回應中 bet=賭注 tableid=表格ID(邀請者ID)
let table = {};//遊玩中分數表 id=受邀者id tablea=分數表a{} tableb=分數表b{} round = 輪數除二為回合數 stage = 現在的遊玩階段(1 初次擲骰完等待選擇骰子,2 重骰一次,3 等待選擇組合) dice = 骰子 {} bet = 賭注
//分數表用索引 "1","2","3","4","5","6","sub","+35","chose","4_of_kind","full_house","s.str","l.str","yacht","total"
//對應中文 "一點","二點","三點","四點","五點","六點","小計","獎勵 +35","全選","四骰同花","葫蘆","小順","大順","快艇 ","總積分"
const tablemap = ["1","2","3","4","5","6","sub","+35","chose","4_of_kind","full_house","s.str","l.str","yacht","total"];//循址用
const chosemap = ["1","2","3","4","5","6","chose","4_of_kind","full_house","s.str","l.str","yacht"]//可供選擇循址表
const chosemap_cn = ["一點","二點","三點","四點","五點","六點","全選","四骰同花","葫蘆","小順","大順","快艇"];
const chosemap_ennum = ['Aces', 'Deuces', 'Threes', 'Fours', 'Fives', 'Sixes'];
const emptytable = {"1":-1,"2":-1,"3":-1,"4":-1,"5":-1,"6":-1,"sub":0,"+35":-1,"chose":-1,"4_of_kind":-1,"full_house":-1,"s.str":-1,"l.str":-1,"yacht":-1,"total":0};//空表
const titel_cn = ["一點","二點","三點","四點","五點","六點","小計","獎勵 +35","全選","四骰同花","葫蘆","小順","大順","快艇","總積分"];
const emptydice = {"dice" : [7,7,7,7,7], "keep" : [0,0,0,0,0]};//空骰子表 dice = 骰出 keep = 保留

//讀寫JSON檔
const playerjson = './player.json';
const tablejson = './table.json';
if(savetype.toLowerCase() == 'json'){
  console.log('啟動JSON存檔');
  try{
    player = require(playerjson);
    console.log('成功開啟player.json');
  }catch(err){
    let fs = require('fs');
    fs.writeFile(playerjson, '', function (err) {
      if (err)
        console.log(err);
      else
        console.log('沒有找到player.json,建立一個新的');
    });
  }
  try{
    table = require(tablejson);
    console.log('成功開啟table.json');
  }catch(err){
    let fs = require('fs');
    fs.writeFile(tablejson, '', function (err) {
      if (err)
        console.log(err);
      else
        console.log('沒有找到table.json,建立一個新的');
    });
  }
}

const { Client, Intents, MessageActionRow } = require('discord.js');
const Yacht_Dice_Bot = new Client({ intents: [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGES
], partials: [
  Intents.FLAGS.CHANNEL
]});

Yacht_Dice_Bot.on('ready', () => {
  console.log(`Logged in as ${Yacht_Dice_Bot.user.tag}!`);
});
//主程式 接收訊息系統
Yacht_Dice_Bot.on('messageCreate', message => {
  console.log(`[${message.channel.name}(${message.channelId})]${message.author.username}(${message.author.id}): ${message.content}`);
  if((!message.author.bot) && (message.channelId == accChannelid)){//確認訊息不是來自機器人的並且在允許的頻道
    if(message.mentions.users.size === 1 && message.mentions.users.every(user => !user.bot)){//發訊息者@1人並且不是@機器人
      let matchuser;
      message.mentions.users.each(user => matchuser = user);
      let matchid = matchuser.id;//對手ID
      if(message.content.indexOf(keyword) != -1){//確認格式
        let bet = -1;
        let checkbet = message.content.split(' ');//確認下注額
        for(let i = 0; i < checkbet.length; i++){
          if(IsNum(checkbet[i])){
            bet = parseInt(checkbet[i], 10);
          }
        }
        if(player[message.author.id] == undefined){//發邀請者是否正在遊戲中 若否
          if(player[matchid] == undefined){//被邀請者是否正在遊戲中 若否
            message.channel.send('<@!' + matchid + '>\n<@!' + message.author.id + '> 邀請你玩遊艇骰子' + ((bet != -1) ? ',賭上' + bet + moneyunit : '') + ' 輸入Y接受 輸入N拒絕');
            player[message.author.id] = {};
            player[matchid] = {};
            player[message.author.id].playing = false;
            player[message.author.id].matching = true;
            player[message.author.id].match = matchid;
            player[message.author.id].reply = false;
            player[message.author.id].bet = bet;
            player[message.author.id].name = message.author.username;
            player[matchid].playing = false;
            player[matchid].matching = true;
            player[matchid].match = message.author.id;
            player[matchid].reply = true;
            player[matchid].bet = bet;  
            player[matchid].name = matchuser.username;
            save(playerjson, player); 
          }else{//被邀請者是否正在遊戲中 若是
            if(player[matchid].playing){
              message.reply('你想邀請的人已經在玩囉');
            }else if(player[matchid].matching){
              if(player[matchid].reply){
                message.reply('你想邀請的人已被其他人邀請');
              }else{
                message.reply('你想邀請的人還在等待回應');
              }
            }else{
              message.reply('你想邀請的人因為某些神秘力量而無法被邀請,請聯絡管理人員');
            }
          }
        }else{//發邀請者是否正在遊戲中 若是
          if(player[message.author.id].playing){
            message.reply('你已經在玩囉');
          }else if(player[message.author.id].matching){
            message.reply('你還在等待回應');
          }else{
            message.reply('你因為某些神秘力量而無法發邀請,請聯絡管理人員');
          }
        }
      }  
    }else if(player[message.author.id] != undefined){//發訊息者是否正在遊戲中 若是
      if(player[message.author.id].reply){//若是在等待回復
        if(message.content.toLowerCase() == 'y'){//若同意
          player[message.author.id].playing = true;
          player[message.author.id].matching = false;
          player[message.author.id].reply = false;
          const matchid = player[message.author.id].match;
          player[matchid].playing = true;
          player[matchid].matching = false;
          player[matchid].reply = false;
          player[message.author.id].tableid = matchid;
          player[matchid].tableid = matchid;
          save(playerjson, player); 
          message.reply('你同意了<@!' + matchid + '>的邀請 開始遊戲');
          //建表
          table[matchid] = {};
          table[matchid].id = message.author.id;
          table[matchid].round = 2;
          table[matchid].tablea = {"1":-1,"2":-1,"3":-1,"4":-1,"5":-1,"6":-1,"sub":0,"+35":-1,"chose":-1,"4_of_kind":-1,"full_house":-1,"s.str":-1,"l.str":-1,"yacht":-1,"total":0};
          table[matchid].tableb = {"1":-1,"2":-1,"3":-1,"4":-1,"5":-1,"6":-1,"sub":0,"+35":-1,"chose":-1,"4_of_kind":-1,"full_house":-1,"s.str":-1,"l.str":-1,"yacht":-1,"total":0};
          table[matchid].dice = {"dice" : [7,7,7,7,7], "keep" : [0,0,0,0,0]};
          table[matchid].stage = 1;
          table[matchid].bet = player[message.author.id].bet;
          //第一回合
          dice(matchid);
          save(tablejson, table); 
          showtable(message.channel, true, matchid, true, '骰出的骰子如下 輸入想保留的骰子編號保留並重骰 \n輸入"重骰"部交換直接重骰 輸入0不重骰開始選組合', '```' + showdice(matchid) + '```');
        }else{//若不同意
          message.reply('你拒絕了<@!' + player[message.author.id].match + '>的邀請');
          delete player[player[message.author.id].match];
          delete player[message.author.id];
          save(playerjson, player); 
        }
      }else if(!player[message.author.id].matching){//若無在等待配對 則進入遊戲本體
        if(message.author.id == (table[player[message.author.id].tableid].round%2 == 0 ? player[message.author.id].tableid : table[player[message.author.id].tableid].id)){//若是發話者的回合
          let tableid = player[message.author.id].tableid;
          switch(table[tableid].stage){
            case 1:
            case 2:
              let numbarr = prenum05(message.content);
              if(numbarr[0]){
                table[tableid].stage = 3;
                message.reply('請選擇組合')
              }else if(numbarr[6]){
                let say = "幫你交換了第";
                for(let i = 1; i < 6; i++){
                  if(numbarr[i]){
                    let keep = table[tableid].dice.keep[i-1];
                    table[tableid].dice.keep[i-1] = table[tableid].dice.dice[i-1];
                    table[tableid].dice.dice[i-1] = keep;
                    say += i + ' ';
                  }
                }
                let allkeep = true;
                for(let i = 0;i < 5;i++){
                  if(table[tableid].dice.dice[i] != 0){
                    allkeep = false;
                  }
                }
                if(allkeep){
                  message.reply('你的骰子全部都保留了,直接進入選擇組合')
                  table[tableid].stage = 3;
                }else{
                  message.reply(say + '個骰子並重骰了')
                  table[tableid].stage++;
                  dice(tableid);
                  }
              }else{
                message.reply('幫你重骰了');
                table[tableid].stage++;
                dice(tableid);
              }
              save(tablejson, table); 
              if(table[tableid].stage != 3){
                showtable(message, false, tableid, true, '骰出的骰子如下 輸入想保留的骰子編號保留並重骰 \n輸入"重骰"不交換直接重骰 輸入0不重骰開始選組合', '```' + showdice(tableid) + '```');        
              }else{
                showtable(message, false, tableid, true, '輸入想選擇的的組合編號(1~12)', '```' + showonlydice(tableid) + '```');
              }
            break;
            case 3://選擇組合
              let chose = prenum112(message.content);
              let chosepoint = 0;
              let presay = '';
              if(chose === 0){//如果無法找出輸入 自動選擇
                chose = autochose(tableid);
                presay = '看不懂你輸入了什麼,所以我幫你選了';
              }else{
                if(table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][chosemap[chose - 1]] != -1){//選到重複則自動選
                  chose = autochose(tableid);
                  presay = '你選到重複的了,所以我幫你選了';
                }
                presay = '你選擇了';
              }
              chosepoint = Yacht(table[tableid].dice)[chosemap[chose - 1]];
              message.reply(presay + chosemap_cn[chose - 1] + ' 點數為' + chosepoint + '點');
              table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][chosemap[chose - 1]] = chosepoint;
              let tat = 0;
              for(let i = 1;i <= 6; i++){//計算小計
                tat += table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][i] != -1 ? table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][i] : 0;
              }
              table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'].sub = tat;
              if(table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb']['+35'] === -1){//若+35已有 則不執行動作
                if(tat >= 63){//+35滿足
                  table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb']['+35'] = 35;
                }else{//若沒滿足 確認是否都選過
                  let allset35 = true;
                  for(let i = 1; i <= 6; i++){
                    if(table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][i] === -1){
                      allset35 = false;
                    }
                  }
                  if(allset35){//若都選了 設為0
                    table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb']['+35'] = 0;
                  }
                }
              }
              for(let i = 7; i <= 13; i++){//計算總計
                tat += table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][tablemap[i]] != -1 ? table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][tablemap[i]] : 0;
              }
              table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'].total = tat;
              save(tablejson, table); 

              //下一回合
              table[tableid].round++;
              if(table[tableid].round < 26){//若12回合則遊戲結束
                table[tableid].dice = {"dice" : [7,7,7,7,7], "keep" : [0,0,0,0,0]};
                table[tableid].stage = 1;
                dice(tableid);
                message.channel.send('<@!' + (table[tableid].round%2 == 0 ? tableid : table[tableid].id) + '> 的回合');
                showtable(message.channel, true, tableid, true, '骰出的骰子如下 輸入想保留的骰子編號保留並重骰 \n輸入"重骰"部交換直接重骰 輸入0不重骰開始選組合', '```' + showdice(tableid) + '```');
                save(tablejson, table); 
              }else{//結束遊戲
                message.channel.send('<@!' + tableid + '> <@!' + player[tableid].match + '>\n遊戲結束了 以下為結果');
                let bet = table[tableid].bet;
                let totala = table[tableid].tablea.total;
                let totalb = table[tableid].tableb.total;
                let playeraid = tableid;
                let playerbid = table[tableid].id;
                let say = '';
                switch(true){
                  case totala > totalb :
                    say = '由' + Yacht_Dice_Bot.users.cache.find(user => user.id === playeraid.toString()).username + '獲得勝利';
                    if(bet > 0){
                      say += '\n賭注為' + bet + moneyunit;
                      //在這裡幫playeraid加上bet數量的錢

                      //在這裡幫playerbid扣掉bet數量的錢
                    }
                  break;
                  case totala < totalb :
                    say = '由' + Yacht_Dice_Bot.users.cache.find(user => user.id === playerbid.toString()).username + '獲得勝利';
                    if(bet > 0){
                      say += '\n賭注為' + bet + moneyunit;
                      //在這裡幫playeraid扣掉bet數量的錢

                      //在這裡幫playerbid加上bet數量的錢
                    }
                  break;
                  default:
                    say = '兩方平手';
                }
                showtable(message.channel, true, tableid, false, '結果', say);
                //刪表
                delete table[tableid];
                delete player[player[message.author.id].match];
                delete player[message.author.id];
                save(tablejson, table); 
                save(playerjson, player); 
              }
            break;
          }
        }
      }
    }
  }
});
//login
Yacht_Dice_Bot.login(token);

//以下為function
function IsNum(s){//判斷是否為數字
  if(s!=null && s!=undefined){
    var r,re;
    re = /\d*/i; //\d表示數字,*表示匹配多回個數字
    r = s.match(re);
    return (r==s && s!='') ? true : false;
  }
  return false;
}

function showtable(pos, ischannel, tableid, showpoint, Footertitel, Footer){ //顯示表格
  console.log(tableid);
  //要發訊息的地方, 是否直接發在頻道, 表的ID, 是否顯示骰出分數, 註腳標題, 註腳內文
  const namea = player[tableid].name;
  const nameb = player[table[tableid].id].name;
  
  let Fields;
  let titleDescription = '';
  if(showpoint){//顯示骰出分數
    let analyze = Yacht(table[tableid].dice);
    let Description = '';
    let anaDescription = '';

    let arrpos = 0;
    let nowpos = 0;
    let count = 1;
    while(arrpos < titel_cn.length){//分數表
      if(nowpos == 6 || nowpos == 9 || nowpos == 16){
        titleDescription += '----\n';
        Description += '------ | ------\n';
        anaDescription += '----\n';
      }else{
        titleDescription += titel_cn[arrpos];
        if(tablemap[arrpos] == 'sub'){
          Description += padRight(table[tableid].tablea[tablemap[arrpos]].toString(), 3) + '/63';
          Description += ' | ';
          Description += padRight(table[tableid].tableb[tablemap[arrpos]].toString(), 3) + '/63';
        }else{
          Description += table[tableid].tablea[tablemap[arrpos]] == -1 ? '      ' : padRight(table[tableid].tablea[tablemap[arrpos]].toString(), 6);
          Description += ' | ';
          Description += table[tableid].tableb[tablemap[arrpos]] == -1 ? ' ' : table[tableid].tableb[tablemap[arrpos]];
        }
        if(analyze[tablemap[arrpos]] != undefined){
          anaDescription += padRight(analyze[tablemap[arrpos]].toString(),3) + ' (' + count++ + ')';
        }
        if(arrpos != titel_cn.length - 1){
          titleDescription += "\n";
          Description += "\n";
          anaDescription += '\n';
        }
        arrpos++;
      }
      nowpos++;
    }

    Fields = [{ name: '組合', value: "```" + titleDescription + '```' , inline: true},
		{ name: namea + " | " + nameb, value: "```" + Description + '```', inline: true },
    { name: '骰出分數(編號)', value: "```" + anaDescription + '```' , inline: true },
    { name: Footertitel, value: Footer }];
  }else{//不顯示骰出分數
    let aDescription = '';
    let bDescription = '';

    let arrpos = 0;
    let nowpos = 0;
    while(arrpos < titel_cn.length){//分數表
      if(nowpos == 6 || nowpos == 9 || nowpos == 16){
        titleDescription += '-----\n';
        aDescription += '------\n';
        bDescription += '------\n';
      }else{
        titleDescription += titel_cn[arrpos];
        if(tablemap[arrpos] == 'sub'){
          aDescription += padRight(table[tableid].tablea[tablemap[arrpos]].toString(), 3) + '/63';
          bDescription += padRight(table[tableid].tableb[tablemap[arrpos]].toString(), 3) + '/63';
        }else{
          aDescription += table[tableid].tablea[tablemap[arrpos]] == -1 ? '   ' : padRight(table[tableid].tablea[tablemap[arrpos]].toString(), 3);
          bDescription += table[tableid].tableb[tablemap[arrpos]] == -1 ? '   ' : padRight(table[tableid].tableb[tablemap[arrpos]].toString(), 3);
        }
        if(arrpos != titel_cn.length - 1){
          titleDescription += "\n";
          aDescription += "\n";
          bDescription += "\n";
        }
        arrpos++;
      }
      nowpos++;
    }

    Fields = [{ name: '組合', value: "```" + titleDescription + '```' , inline: true},
		{ name: namea, value: "```" + aDescription + '```', inline: true },
    { name: nameb, value: "```" + bDescription + '```', inline: true },
    { name: Footertitel, value: Footer }];
  }
  
  const embed = new MessageEmbed()
  .setColor('#ffff00')
  .setAuthor({'name' : (showpoint ? ((table[tableid].round%2 == 0 ? namea : nameb) + '(' + table[tableid].stage + '/3)') : namea + '與' + nameb + '的遊戲結果')})
  .setTitle(showpoint ? '遊艇骰子分數表  回合:' + Math.floor(table[tableid].round/2) + '/12' : '遊艇骰子最終結果分數表')
  .setDescription('<@!' + tableid + '> 和 <@!' + table[tableid].id + '> 的對戰')
  .addFields(Fields);
  ischannel ? pos.send({ embeds: [embed]}) : pos.reply({ embeds: [embed]});
}

function dice(tableid){//骰骰子
  for(let i = 0; i < 5; i++){
    if(table[tableid].dice.dice[i] != 0){
      table[tableid].dice.dice[i] = random(1, 6);
    }
  }
}

function showdice(tableid){//將骰子表變成字串
  dicestring = '編號| 1 | 2 | 3 | 4 | 5 |\n------------------------\n骰出| ';
  for(let i = 0; i < 5; i++){
    if(table[tableid].dice.dice[i] > 0){
      dicestring += table[tableid].dice.dice[i];
    }else{
      dicestring += ' ';
    }
    if(i < 4){
      dicestring += ' | ';
    }
  }
  dicestring += ' |\n保留| '
  for(let i = 0; i < 5; i++){
    if(table[tableid].dice.keep[i] > 0){
      dicestring += table[tableid].dice.keep[i];
    }else{
      dicestring += ' ';
    }
    if(i < 4){
      dicestring += ' | ';
    }
  }
  dicestring += ' |'
  return dicestring;
}

function showonlydice(tableid){//將骰子表變成字串
  dicestring = '骰點| ';
  for(let i = 0; i < 5; i++){
      dicestring += table[tableid].dice.dice[i] != 0 ? table[tableid].dice.dice[i] : table[tableid].dice.keep[i];
    if(i < 4){
      dicestring += ' | ';
    }
  }
  dicestring += ' |'
  return dicestring;
}

function random(min, max){//隨機函式 min=最小值 max=最大值
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function padRight(str,length){//補空格
  if(str.length >= length){
    return str;
  }else{
    return padRight(str+" ", length);
  }
}

function padLeft(str,length){//補空格
  if(str.length >= length){
    return str;
  }else{
    return padLeft(" "+str, length);
  }
}

function Yacht(dicein) {//辨識骰子組合
  let dice = [0,0,0,0,0];
  for (let i = 0; i < 5; i++){
    dice[i] = dicein.dice[i] != 0 ? dicein.dice[i] : dicein.keep[i];
  }
  sort(dice);
  
  let analyze = {"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"chose":0,"4_of_kind":0,"full_house":0,"s.str":0,"l.str":0,"yacht":0};
  //Aces , Deuces , Threes , Fours , Fives , Sixes , Choice 
  for(let i = 0; i < 5; i++){
    analyze[dice[i]] += dice[i];
    analyze.chose += dice[i];
  }
  //4 of a Kind 
  if((dice[0] == dice[1] && dice[0] == dice[2] && dice[0] == dice[3]) || (dice[1] == dice[2] && dice[1] == dice[3] && dice[1] == dice[4])){
    analyze['4_of_kind'] = analyze.chose;
  }
  //Full House 
  if(dice[0] != dice[4] && ((dice[0] == dice[1] && dice[0] == dice[2] && dice[3] == dice[4]) || (dice[0] == dice[1] && dice[2] == dice[3] && dice[2] == dice[4]))){
    analyze.full_house = analyze.chose;
  }
  //S. Straight , L. Straight 
  let Pcount = 0, Crcount = 0,start = dice[0];
  for(let i = 0; i < 5; i++){
    if(dice[i] == start){
      Crcount++;
      start++;
    }else if (dice[i] == start+1){
      start += 2;
      Crcount = 1;
    }
    if(Crcount > Pcount){
      Pcount = Crcount;
    }
    if(start > 6){
      break;
    }
  }
  if(Pcount >= 4){
    analyze['s.str'] = 15;
  }
  if(Pcount == 5){
    analyze['l.str'] = 30;
  }
  //Yacht 
  if(dice[0] == dice[1] && dice[0] == dice[2] && dice[0] == dice[3] && dice[0] == dice[4]){
    analyze.yacht = 50;
  }
  return analyze;
}

function sort(sco) {//排序
  let temp;
  for (let i = 0; i < sco.length - 1; i++) {
    let Flag = false;
    for (let j = 0; j < sco.length - 1 - i; j++) {
      if (sco[j] > sco[j + 1]) {
        temp = sco[j];
        sco[j] = sco[j + 1];
        sco[j + 1] = temp;
        Flag = true;
      }
    }
    if (!Flag){
      break;
    }
  }
}

function prenum05(str){//檢視0~5 於字串中有無出現
  let re = [false,false,false,false,false,false,false];//0~5 6為0以外有無出現
  for(let i = 0; i < str.length; i++){
    if(IsNum(str[i])){
      let cint = parseInt(str[i],10);
      if(cint >= 0 && cint <= 5){
        re[cint] = true;
        if(cint != 0){
          re[6] = true;
        }
      }
    }
  }
  return re;
}

function prenum112(str){//於字串中尋找關於組合的編號或是文字
  let chose = 0;
  if(str.indexOf('<@') === -1 && str.indexOf('<#') === -1 && str.indexOf('<:') === -1&& str.indexOf('<a:') === -1){//不是@或符號等
    for(let i = 1; i <= 9; i++){//找1~9
      if(str.indexOf(i.toString()) != -1){
        chose = i;
        break;
      }
    }
    if(chose === 1 || chose === 2){//如果是1或2 再確認是不是10~12
      for(let i = 10; i <= 12; i++){
        if(str.indexOf(i.toString()) != -1){
          chose = i;
          break;
        }
      }
    }
    if(chose === 0){//如果到現在都找不到 找英文中文
      for(let i = 0; i < 12; i++){
        if((str.indexOf(i < 6 ? chosemap_ennum[i] :chosemap[i]) != -1) || (str.indexOf(chosemap_cn[i]) != -1)){
          chose = i + 1;
          break;
        }
      }
    }
  }//回傳0代表找不到
  return chose;
}

function autochose(tableid){//自動選擇
  let analyze = Yacht(table[tableid].dice);
  let max = -1;
  let chose = -1;
  for(let i = 0; i < chosemap.length; i++){
    if(table[tableid][table[tableid].round%2 == 0 ? 'tablea' : 'tableb'][chosemap[i]] === -1){
      if(analyze[chosemap[i]] > max){
        max = analyze[chosemap[i]];
        chose = i + 1;
      }
    }
  }
  if(chose === -1){
    chose = 0;
  }
  return chose;
}

function save(path, json){//存檔
  if(savetype.toLowerCase() == 'json'){
    let fs = require('fs');
    fs.writeFileSync(path, JSON.stringify(json));
  }
}
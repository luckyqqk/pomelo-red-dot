# red-dot
pomelo GM red-dot plugin

### 用途分析
* 对于手游来讲,如果将所有信息直接推送,则会耗费玩家大量的流量.
* 于是有人就发明了红点系统,用很小的流量提示玩家某些模块的改变,让玩家自己决定是否去获取新的改变.

### 设计思路
1.定义模块红点
* 每个游戏的模块不同,也不是所有的模块均需要变更提示,那么,我们需要定义出红点系统会用到的模块(redDot.json).如下:

|用英文id会方便研发者直观的看出作用模块,未用数字id,是因为该id并不参与运算|红点代表功能|
|:-------:|:--:|
|id	      |desc|
|mail	    |邮件 |
|camp	    |阵营 |
|guild	  |公会 |
|active1	|活动1|
|active2	|活动2|
|active3	|活动3|
* 注:系统红点和个人红点很容易混淆,俩种红点的实现方式不同.
*    如背包新增了一个东西的红点提示,或者免费抽卡红点均是个人红点,个人红点不缓存,用后即消失,可直接用push方式搞定.

2.定义红点面板
* 由于不同游戏的ui排版不同,不可能在某一ui下固定的存在某些模块(研发过程中也可能会更改ui排版),
* 甚至不同游戏大区的面板由一个红点系统控制,那么我们需要配置模块红点的所在ui面板(redBoard.json).如下:

|红点面板         |所含红点模块             |最大版本   |红点面板说明|
|:-------------:|:---------------------:|:---------:|:-------:|
|id             |	redDot                |	maxVersion|	desc    |
|red-dot-ui	    |mail,camp,guild        |	10        |	主ui红点 |
|red-dot-active	|active1,active2,active3| 10        |	活动红点 |

* 红点系统是做提示用的,我们不必须保留所有历史变更,通常来讲,够用即可,多了反而乱而无用.
* 当version达到最大值,就从0重新赋值,那么缓存多少个版本最好?默认10个,不合适就自己调整.

3.静态数据已经定义好了,那么动态数据存放在哪?
* mysql么?不,我们选择redis.
* 因为我们希望GM在管理后台可以更新活动,玩家在游戏服可以看到.
* 鉴于redis对server天生的友好,恰好用在此处.

4.红点面板的动态数据格式
* 某个面板下会有几个模块,需要存储这几个模块是否有变化(true|false).
* 仅有2种结果的数值,用位存储最为合适.于是我在红点系统中引入了[二进制开关](https://github.com/luckyqqk/binarySwitch).
* 之后,便可用一个十进制数表示一个红点面板的一个version内容.达到模块变更提示,而且耗费的流量很少.
* 注:这里仅仅是服务端的设计,前端拿到十进制数后需解析(位运算)后才能真正将红点展示到对应面板上.

### 如何使用
1. 进入pomelo项目的game-server下
```
npm install pomelo-red-dot --save
```
2. 将我们上面设计的两张表用[倒表工具](https://github.com/luckyqqk/excel2json)导出json.
3. 在服务配置中加上如下代码:
```
app.use(require('pomelo-red-dot'), {
        red : {
                host: '192.168.1.xxx',                // redis host
                port: 6379,                           // redis port
                redBoardPath:'xx/redBoard.json'       // 上文我们导出的json位置
            }
        });
 ```
 4. 如何新增红点
 ```
 pomelo.app.event.emit(redBoardId, idxArr);
 ```
 * redBoardId:自定义的红点面板id
 * idxArr:面板中状态改变的模块下标
 * 例如:
 ```
 pomelo.app.event.emit(red-dot-active, [0,1]);
 ```
 * 表示活动面板下的活动1和活动2有变更.
 
 5. 查看所有红点状态则调用
 ```
 pomelo.app.get('redDot').getAllRedDot(cb);
 ```



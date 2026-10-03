K Esports Lab｜LoL 國際／盃賽選擇更新
日期：2026-10-03

本次只更新 League of Legends，不加入 CS2、VALORANT 或其他遊戲。

【本次完成】
1. 後台「賽區」改為「賽事／賽區」。
2. 保留原六大賽區：LCK / LPL / LCP / LEC / LCS / CBLOL。
3. 新增：
   - 2026 德瑪西亞杯
   - 2026 世界賽
4. 國際／盃賽採「當屆參賽名單」：只引用原本戰隊資料庫，不複製整份戰隊資料。
5. 2026 德瑪西亞杯目前載入 12 支參賽隊伍。
6. 2026 世界賽目前載入 18 支已確定晉級隊伍；最後 1 個 CBLOL 名額尚未決定。
7. 賽事中心／賽果紀錄新增國際賽篩選項目。
8. 不需要資料庫 migration，不修改付款、K Premium、購買統計或 API。

【部署方式】
把此更新包中的檔案依原路徑覆蓋／新增到 k-esports-lab：
- admin.html                         （覆蓋）
- matches.html                       （覆蓋）
- results.html                       （覆蓋）
- assets/js/archive.js               （覆蓋）
- assets/js/tournaments.js           （新增）

【之後更新國際賽名單】
只需要修改 assets/js/tournaments.js。
每一屆都以獨立名稱保存，例如：
- 2026 世界賽
- 2027 世界賽

這樣不需要把全球所有隊伍塞進單一國際賽，也不會影響原本六大賽區的戰隊資料庫。

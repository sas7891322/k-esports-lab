K Esports Lab v2.5.2d｜比分命中中央判定修正

本版將預測比分命中判定移到後端：
1. 首頁、單場賽後頁、後台都以同一套後端邏輯判斷。
2. 支援「TSW 3：1 GAM」這種比分後仍有隊名的格式。
3. 舊資料即使資料庫曾存 resultHit=false，讀取時也會重新核算，所以不用逐場重做。
4. 未來確認完賽時，後端也會在儲存前重新核算 resultHit。
5. 不影響金流、提醒、Premium 解鎖，也不增加 Serverless Function 數量（results.js 位於 _lib）。

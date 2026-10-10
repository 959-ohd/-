from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sqlite3
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 跨域允许前端访问接口
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库表
def init_db():
    conn = sqlite3.connect("./run.db")
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS run_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distance REAL,
        time_str TEXT,
        record_date TEXT,
        note TEXT
    )
    ''')
    conn.commit()
    conn.close()

init_db()

# 请求体模型
class RunRecord(BaseModel):
    distance: float
    time_str: str
    record_date: str
    note: Optional[str] = ""

# 新增打卡接口
@app.post("/api/record")
def add_record(item: RunRecord):
    try:
        conn = sqlite3.connect("./run.db")
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO run_record(distance, time_str, record_date, note) VALUES (?,?,?,?)",
            (item.distance, item.time_str, item.record_date, item.note)
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"ok": True, "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取全部打卡记录接口
@app.get("/api/record", response_model=List[dict])
def get_all():
    conn = sqlite3.connect("./run.db")
    cur = conn.cursor()
    cur.execute("SELECT id, distance, time_str, record_date, note FROM run_record ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    res = []
    for r in rows:
        res.append({
            "id": r[0],
            "distance": r[1],
            "time_str": r[2],
            "record_date": r[3],
            "note": r[4]
        })
    return res

# 本地运行入口
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

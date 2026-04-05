import uvicorn
import os

if __name__ == "__main__":
    dev_reload = os.getenv("ALERT_ACC_RELOAD", "0").strip() == "1"
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=dev_reload)

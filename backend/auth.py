import os
import time
import pickle

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict

auth = FastAPI()

auth.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def login_and_save_cookies(email: str, password: str):
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")

    driver = webdriver.Firefox(options=options)
    try:
        driver.get("https://accounts.google.com/signin/v2/identifier?service=youtube")

        time.sleep(2)
        driver.find_element("id", "identifierId").send_keys(email)
        driver.find_element("id", "identifierNext").click()

        time.sleep(3)
        driver.find_element("name", "password").send_keys(password)
        driver.find_element("id", "passwordNext").click()

        time.sleep(10)  # Подожди пока загрузится

        os.makedirs(os.path.dirname(COOKIES_PATH), exist_ok=True)
        with open(COOKIES_PATH, "wb") as file:
            pickle.dump(driver.get_cookies(), file)

        return True
    except Exception as e:
        print("Ошибка входа:", e)
        return False
    finally:
        driver.quit()

def load_cookies_to_browser(driver):
    if not os.path.exists(COOKIES_PATH):
        return
    with open(COOKIES_PATH, "rb") as file:
        cookies = pickle.load(file)
        for cookie in cookies:
            driver.add_cookie(cookie)
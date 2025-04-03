FROM python:3.13-slim

COPY requirements.txt requirements.txt
RUN pip install annotated-types==0.7.0 --timeout=100 --index-url https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install -r requirements.txt


COPY . .

CMD [ "python", "main.py"]
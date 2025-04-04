FROM python:3.13-slim

COPY requirements.txt requirements.txt
##RUN pip install -r requirements.txt
RUN pip install -r requirements.txt --default-timeout=100 future

COPY . .

CMD [ "python", "main.py"]
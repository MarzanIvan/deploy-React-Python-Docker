FROM python:3.13-slim

COPY requirements.txt requirements.txt
##RUN pip install -r requirements.txt
RUN pip install -r requirements.txt --default-timeout=1250 future
RUN pip install python-multipart


COPY . .

CMD [ "python", "main.py"]
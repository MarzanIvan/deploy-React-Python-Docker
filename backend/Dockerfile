FROM python:3.13-slim

COPY requirements.txt requirements.txt
RUN pipx install annotated-types
RUN pip install -r requirements.txt

COPY . .

CMD [ "python", "main.py"]
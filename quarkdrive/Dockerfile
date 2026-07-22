FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY quark_client/ quark_client/
COPY main.py .
COPY frontend/ frontend/

RUN mkdir -p /data

ENV PORT=8080
ENV QUARK_DATA_DIR=/data

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]

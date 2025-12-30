import time
import random
import requests
from sawtooth_sdk.signing import create_context
from sawtooth_intkey_default.intkey_message_factory import IntkeyMessageFactory

# Khởi tạo khóa bảo mật cho "thiết bị"
context = create_context('secp256k1')
private_key = context.new_random_private_key()
signer = context.new_signer(private_key)
factory = dỉ(signer=signer)

#URL_REST_API = "http://localhost:8008/batches"
URL_REST_API = "http://rest-api:8008/batches"

def send_data(sensor_name, value):
    # Tạo giao dịch 'set' giá trị cho sensor_name
    batch_list = factory.create_batch([factory.create_transaction('set', sensor_name, value)])
    batch_data = batch_list.SerializeToString()
    
    response = requests.post(
        URL_REST_API,
        data=batch_data,
        headers={'Content-Type': 'application/octet-stream'}
    )
    print(f"Send {sensor_name}: {value} | Status: {response.status_code}")

if __name__ == "__main__":
    while True:
        temp = int(random.uniform(20, 35) * 100) # Giả lập nhiệt độ
        humi = int(random.uniform(50, 90) * 100) # Giả lập độ ẩm
        
        send_data("Temperature", temp)
        send_data("Humidity", humi)
        
        print("Waiting 5 seconds...")
        time.sleep(5)
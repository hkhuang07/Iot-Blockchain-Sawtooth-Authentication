import hashlib
import logging
import json
from sawtooth_sdk.processor.handler import TransactionHandler
from sawtooth_sdk.processor.exceptions import InvalidTransaction

LOGGER = logging.getLogger(__name__)

FAMILY_NAME = "GardenContract"
FAMILY_VERSION = "1.0"
# Prefix là 6 ký tự đầu của hash family name
FAMILY_PREFIX = hashlib.sha512(FAMILY_NAME.encode()).hexdigest()[:6]

def _hash(value):
    return hashlib.sha512(value.encode()).hexdigest()

def _get_device_address(device_id):
    return FAMILY_PREFIX + _hash(device_id)[:64]

class GardenHandler(TransactionHandler):
    def __init__(self):
        # Không gán self.family_name ở đây để tránh lỗi abstract class
        pass

    # BẮT BUỘC dùng @property cho 3 hàm này
    @property
    def family_name(self):
        return FAMILY_NAME

    @property
    def family_versions(self):
        return [FAMILY_VERSION]

    @property
    def namespaces(self):
        return [FAMILY_PREFIX]

    def apply(self, transaction, context):
        """
        Hàm xử lý chính. 'context' là đối tượng để đọc/ghi state trên blockchain.
        """
        header = transaction.header
        signer_public_key = header.signer_public_key

        try:
            payload = json.loads(transaction.payload.decode('utf-8'))
        except Exception:
            raise InvalidTransaction("Dữ liệu Payload không phải JSON hợp lệ")

        action = payload.get('action')
        device_id = payload.get('device_id')

        LOGGER.info(f"Transaction: action={action}, device_id={device_id}")

        if action == "REGISTER_DEVICE":
            self._handle_register(context, payload, signer_public_key)
        elif action == "SEND_TELEMETRY":
            self._handle_telemetry(context, payload, signer_public_key)
        else:
            raise InvalidTransaction(f"Hành động không hợp lệ: {action}")

    def _handle_register(self, context, payload, public_key):
        device_id = payload.get('device_id')
        address = _get_device_address(device_id)

        # Kiểm tra xem đã đăng ký chưa
        entries = context.get_state([address])
        if entries:
            raise InvalidTransaction(f"Thiết bị {device_id} đã tồn tại!")

        record = {
            'device_id': device_id,
            'public_key': public_key,
            'status': 'registered',
            'timestamp': payload.get('timestamp')
        }

        # Ghi vào state
        context.set_state({address: json.dumps(record).encode('utf-8')})
        LOGGER.info(f"Đăng ký thành công thiết bị: {device_id}")

    def _handle_telemetry(self, context, payload, public_key):
        device_id = payload.get('device_id')
        address = _get_device_address(device_id)

        # Lấy dữ liệu thiết bị để kiểm tra quyền
        entries = context.get_state([address])
        if not entries:
            raise InvalidTransaction("Thiết bị chưa được đăng ký!")

        # Logic Smart Contract: Tự động bật máy bơm nếu độ ẩm thấp
        humidity = float(payload.get('humidity', 100))
        pump_status = "ON" if humidity < 30.0 else "OFF"
        
        # Lưu dữ liệu Telemetry (Địa chỉ mới dựa trên timestamp)
        ts = str(payload.get('timestamp'))
        telemetry_address = FAMILY_PREFIX + _hash(f"{device_id}_data")[:22] + _hash(ts)[:42]

        data_to_store = {**payload, 'pump_status': pump_status}
        
        context.set_state({
            telemetry_address: json.dumps(data_to_store).encode('utf-8')
        })
        LOGGER.info(f"Ghi nhận Telemetry: {device_id} | Pump: {pump_status}")
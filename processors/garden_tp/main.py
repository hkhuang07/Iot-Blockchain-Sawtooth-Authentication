#!/usr/bin/env python3
"""
Garden Contract Transaction Processor - Main Entry Point (Fixed)
"""

import argparse
import logging
import sys
import os
from sawtooth_sdk.processor.core import TransactionProcessor
# Loại bỏ các import config gây lỗi
from handler import GardenHandler, FAMILY_NAME, FAMILY_VERSION

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)

def main():
    """Main entry point for Garden Contract TP"""
    parser = argparse.ArgumentParser(
        description='Garden Contract Transaction Processor'
    )
    parser.add_argument(
        '-C', '--connect',
        default='tcp://localhost:4004',
        help='Validator endpoint (default: tcp://localhost:4004)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='count',
        default=0,
        help='Increase verbosity'
    )

    args = parser.parse_args()

    # Thiết lập log level
    log_levels = [logging.WARNING, logging.INFO, logging.DEBUG]
    log_level = log_levels[min(args.verbose, 2)]
    logging.getLogger('sawtooth_sdk.processor').setLevel(log_level)

    LOGGER.info("=" * 60)
    LOGGER.info("Garden Contract Transaction Processor Starting...")
    LOGGER.info(f"Family: {FAMILY_NAME} | Version: {FAMILY_VERSION}")
    LOGGER.info(f"Connecting to validator: {args.connect}")
    LOGGER.info("=" * 60)

    # 1. Khởi tạo Processor
    processor = TransactionProcessor(url=args.connect)
    
    # 2. KHỞI TẠO VÀ ĐĂNG KÝ HANDLER (Bước này cực kỳ quan trọng)
    handler = GardenHandler()
    processor.add_handler(handler)

    try:
        # 3. Bắt đầu chạy
        processor.start()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down Garden Contract TP...")
        processor.stop()
    except Exception as e:
        LOGGER.error(f"Processor error: {e}")
        # Đảm bảo dừng processor khi có lỗi để tránh treo port
        try:
            processor.stop()
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Garden Contract Transaction Processor - Main Entry Point
"""

import argparse
import logging
import sys
import os

from sawtooth_sdk.processor.core import Processor
from sawtooth_sdk.processor.log import init_console_logging
from sawtooth_sdk.processor.config import load_default_config
from sawtooth_sdk.processor.config import load_toml_config

from handler import GardenHandler, FAMILY_NAME, FAMILY_VERSION

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)


def main():
    """Main entry point for Garden Contract TP"""
    # Parse command line arguments
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
        help='Increase verbosity (can be used multiple times)'
    )
    parser.add_argument(
        '-F', '--config-file',
        default=None,
        help='Path to config file'
    )

    args = parser.parse_args()

    # Set log level based on verbosity
    log_levels = [logging.WARNING, logging.INFO, logging.DEBUG]
    log_level = log_levels[min(args.verbose, 2)]
    logging.getLogger('sawtooth_sdk.processor').setLevel(log_level)

    LOGGER.info("=" * 60)
    LOGGER.info("Garden Contract Transaction Processor Starting...")
    LOGGER.info(f"Family: {FAMILY_NAME}")
    LOGGER.info(f"Version: {FAMILY_VERSION}")
    LOGGER.info(f"Connecting to validator: {args.connect}")
    LOGGER.info("=" * 60)

    # Create processor
    processor = Processor(
        handler=GardenHandler(),
        endpoint=args.connect
    )

    try:
        processor.start()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down Garden Contract TP...")
        processor.stop()
    except Exception as e:
        LOGGER.error(f"Processor error: {e}")
        processor.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()

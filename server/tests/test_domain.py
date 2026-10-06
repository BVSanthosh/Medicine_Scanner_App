"""Unit tests for the pure domain logic: batch normalisation and barcode decoding."""

import pytest

from src.services.barcode import decode
from src.services.batch import normalise_batch_number

GS = "\x1d"


class TestBatchNormalisation:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("49302", "49302"),
            ("B.NO.49302", "49302"),
            ("B.NO. 49302", "49302"),
            ("b.no 49302", "49302"),
            ("BATCH NO: ABC-123", "ABC-123"),
            ("Batch Number - ABC-123", "ABC-123"),
            ("lot abc-123", "ABC-123"),
            ("LOT: ABC-123", "ABC-123"),
            ("  b.no.  49302  ", "49302"),
        ],
    )
    def test_strips_labels(self, raw, expected):
        assert normalise_batch_number(raw) == expected

    def test_label_without_separator_is_not_a_label(self):
        # The regression this rule exists for: "LOT9" is a batch, not the label
        # "LOT" followed by "9".
        assert normalise_batch_number("LOT9") == "LOT9"
        assert normalise_batch_number("BNO123") == "BNO123"

    def test_typed_and_scanned_agree(self):
        assert normalise_batch_number("B.NO. 49302") == normalise_batch_number("49302")

    def test_drops_ocr_noise(self):
        assert normalise_batch_number("49302|") == "49302"
        assert normalise_batch_number("AB*C-1") == "ABC-1"

    def test_empty_and_label_only(self):
        assert normalise_batch_number("") == ""
        assert normalise_batch_number("   ") == ""
        assert normalise_batch_number("B.NO.") == ""

    def test_truncates(self):
        assert len(normalise_batch_number("A" * 200)) == 64


class TestBarcodeDecoding:
    def test_gs1_128_with_separators(self):
        result = decode(f"010500015810305417261200{GS}10ABC-123{GS}21SN0099")
        assert result.gtin == "05000158103054"
        assert result.batch_number == "ABC-123"
        assert result.serial == "SN0099"
        # Day "00" means end of month, so only the month is asserted.
        assert result.exp_date == "12/2026"

    def test_fixed_length_ai_needs_no_separator(self):
        result = decode("010500015810305417280131" + "10LOT9")
        assert result.gtin == "05000158103054"
        assert result.exp_date == "31/01/2028"
        assert result.batch_number == "LOT9"

    def test_bracketed_human_readable_form(self):
        result = decode("(01)05000158103054(11)250601(10)B42(17)270930")
        assert result.gtin == "05000158103054"
        assert result.batch_number == "B42"
        assert result.mfd_date == "01/06/2025"
        assert result.exp_date == "30/09/2027"

    def test_symbology_prefix_is_stripped(self):
        result = decode("]C1010500015810305410XYZ")
        assert result.gtin == "05000158103054"
        assert result.batch_number == "XYZ"

    def test_plain_ean13_has_gtin_but_no_batch(self):
        result = decode("5000158103054")
        assert result.gtin == "05000158103054"
        assert result.batch_number == ""
        assert not result.has_gs1_data

    def test_junk_payload_invents_nothing(self):
        result = decode("https://example.com/promo")
        assert result.gtin == ""
        assert result.batch_number == ""

    def test_empty_payload(self):
        assert decode("").gtin == ""

    def test_bad_check_digit_is_not_accepted_as_gtin(self):
        # 5000158103055 has an invalid check digit (the valid one ends in 4).
        result = decode("5000158103055")
        assert result.gtin == ""

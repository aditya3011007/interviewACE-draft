import os
from io import BytesIO
from typing import Tuple

from fastapi import HTTPException, UploadFile, status

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency
    PdfReader = None

try:
    from docx import Document
except ImportError:  # pragma: no cover - optional dependency
    Document = None


SUPPORTED_DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def _normalize_text(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r", "\n").split("\n")]
    return "\n".join([line for line in lines if line]).strip()


def _parse_pdf(file_bytes: bytes) -> str:
    if PdfReader is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF parsing is not available on the server.",
        )

    reader = PdfReader(BytesIO(file_bytes))
    text_chunks = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            text_chunks.append(page_text)

    return _normalize_text("\n".join(text_chunks))


def _parse_docx(file_bytes: bytes) -> str:
    if Document is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DOCX parsing is not available on the server.",
        )

    document = Document(BytesIO(file_bytes))
    text_chunks = [paragraph.text for paragraph in document.paragraphs if paragraph.text]
    return _normalize_text("\n".join(text_chunks))


def parse_document_bytes(filename: str, file_bytes: bytes) -> str:
    extension = os.path.splitext(filename or "")[1].lower()
    if extension not in SUPPORTED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Use PDF, DOCX, TXT, or MD.",
        )

    if extension == ".pdf":
        text = _parse_pdf(file_bytes)
    elif extension == ".docx":
        text = _parse_docx(file_bytes)
    else:
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        text = _normalize_text(text)

    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded document did not contain readable text.",
        )

    return text


async def parse_uploaded_document(upload: UploadFile) -> Tuple[str, str]:
    file_bytes = await upload.read()
    filename = upload.filename or "document.txt"
    parsed_text = parse_document_bytes(filename, file_bytes)
    return filename, parsed_text

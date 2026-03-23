import fitz

async def extract_text_from_pdf(file_content: bytes):

    doc = fitz.open(stream=file_content, filetype='pdf')

    full_text = []

    for page_num, page in enumerate(doc):
        text = page.get_text()
        clean_text = text.replace("\n", ' ').strip()

        if clean_text:
            full_text.append({
                "page": page_num + 1,
                "text": clean_text
            })

    print(f'[Full_Text]: {full_text}')
    return full_text
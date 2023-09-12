# Extract and save PDF data to a .txt file for easier analysis
# Part of the BMX-Bookmark-Extractor suite by cooperability
import PyPDF2
import re


pdffileobj = open('nftarticle.pdf', 'rb')
pdfreader = PyPDF2.PdfReader(pdffileobj)
numofpages = len(pdfreader.pages)

# we will use file handling here - dont forget to put r before you put the file path
# right click a file -> properties and copy the location path in the quotes below here.
file1 = open(r"output.txt", "a")

# Iterate through each page
for x in range(numofpages):
    pageobj = pdfreader.pages[x]
    text = pageobj.extract_text()

    # Split-by-regex (needs improvement)
    # Remove extra whitespace and split text into sentences:
    sentences = re.split(r'(?<=[.!?]) +', text)
    # Split text into paragraphs based on consecutive newlines:
    # paragraphs = re.split(r'\n\s*\n', text)

    # Group sentences into lines and write to the output file
    line = ""
    for sentence in sentences:
        if len(line) + len(sentence) < 80:
            line += sentence + " "
        else:
            file1.write(line.strip() + '\n')
            line = sentence + " "

    if line:
        file1.write(line.strip() + '\n')

    #     Write paragraphs to the output file
    #     for paragraph in paragraphs:
    #         paragraph = paragraph.strip()  # Remove leading/trailing whitespace
    #         if paragraph:
    #             # Add two newlines after each paragraph
    #             file1.write(paragraph + '\n\n')

file1.close()
pdffileobj.close()

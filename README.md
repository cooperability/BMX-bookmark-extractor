# BMX-bookmark-extractor

![](https://github.com/cooperability/BMX-bookmark-extractor/blob/main/Screen%20Recording%202023-09-18%20at%201.07.22%20PM.gif)
Infrastructure snippets building toward a comprehensive scraping-NLP pipeline for web links.

## Setup

### Prerequisites
- Docker installed on your system
- Git (optional, for cloning the repository)

### Steps

1. Clone the repository (if you haven't already):
   ```
   git clone https://github.com/cooperability/BMX-bookmark-extractor.git
   cd BMX-bookmark-extractor
   ```

2. Build the Docker image:
   ```
   docker build -t bmx .
   ```

3. Run the Docker container:
   ```
   docker run -p 8080:8080 bmx
   ```

4. Access the application:
   Open your web browser and navigate to `http://localhost:8080`

### Configuration

The application uses several AI models and libraries. These are automatically installed during the Docker build process. The main components are:

- Flask web framework
- spaCy for NLP tasks
- Transformers library for T5 summarization and MobileBERT sentiment analysis
- BeautifulSoup for web scraping

You can view the full list of dependencies in the `requirements.txt` file.

### Development

If you want to make changes to the application:

1. Modify the necessary files in the `app` directory.
2. Rebuild the Docker image:
   ```
   docker build -t bmx .
   ```
3. Run the new container to test your changes.

### Troubleshooting

If you encounter any issues:

1. Ensure Docker is running on your system.
2. Check if the required ports are available (8080 by default).
3. Review the Docker logs for any error messages:
   ```
   docker logs <container_id>
   ```

For more detailed information about the application structure and functionality, refer to the `app.py` file.

This setup process using Docker ensures a consistent environment across different systems and simplifies the deployment process.

## Dependencies

- **fastapi**: Required for building the API.
- **uvicorn**: ASGI server for running FastAPI.
- **sqlalchemy**: ORM for database interactions.
- **pydantic**: Data validation and settings management.
- **asyncpg**: Async PostgreSQL client.
- **beautifulsoup4**: HTML and XML parsing.
- **requests**: HTTP requests.
- **PyPDF2**: PDF manipulation.
- **spacy**: NLP library.
- **youtube-transcript-api**: Fetch YouTube transcripts.
- **python-dotenv**: Load environment variables from `.env` file.
- **neo4j**: Neo4j database driver.
- **pinecone**: Vector database service.
- **numpy**: Numerical computations.
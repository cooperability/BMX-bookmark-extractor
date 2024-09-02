async def init_db():
    try:
        # Initialize PostgreSQL
        engine = create_engine(settings.POSTGRES_DATABASE_URI, pool_pre_ping=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Test PostgreSQL connection
        with SessionLocal() as session:
            session.execute("SELECT 1")
        logger.info("PostgreSQL connection established")

        # Initialize Milvus
        connections.connect(
            alias="default",
            host=settings.MILVUS_HOST,
            port=settings.MILVUS_PORT
        )
        logger.info("Milvus connection established")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise
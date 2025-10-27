#!/bin/bash

# Script to create ThirdEye database views in MySQL

echo "🔧 Creating ThirdEye Database Views..."
echo ""

# Database connection details
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASS="password"
DB_NAME="openmetadata_db"

# SQL file location
SQL_FILE="../thirdeye-ui/react-app-old/thirdeye/setup/scores_init.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

echo "📄 Using SQL file: $SQL_FILE"
echo "🗄️  Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Check if MySQL client is available
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL client not found!"
    echo ""
    echo "Alternative: Run this command manually:"
    echo ""
    echo "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < $SQL_FILE"
    echo ""
    exit 1
fi

# Execute the SQL file
echo "Creating views..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Views created successfully!"
    echo ""
    echo "Created views:"
    echo "  • v_table_purge_scores"
    echo "  • v_datalake_health_metrics"
    echo ""
    echo "🎉 ThirdEye database setup complete!"
else
    echo ""
    echo "❌ Failed to create views"
    echo ""
    echo "You can try manually:"
    echo "  1. Connect to MySQL:"
    echo "     mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p"
    echo "  2. Use the database:"
    echo "     USE $DB_NAME;"
    echo "  3. Run the SQL script:"
    echo "     source $SQL_FILE;"
fi

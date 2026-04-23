const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://ndirangu23githinji_db_user:G3JRCA2k5CsshglJ@cluster0.hl67ehe.mongodb.net/?appName=Cluster0';

async function checkVoters() {
    try {
        await mongoose.connect(MONGODB_URI);
        const voterSchema = new mongoose.Schema({}, { strict: false });
        const Voter = mongoose.model('Voter', voterSchema, 'voters');
        
        const count = await Voter.countDocuments({});
        const simCount = await Voter.countDocuments({ 'voterMetadata.isSimulation': true });
        const firstVoter = await Voter.findOne({});
        
        console.log(`TOTAL_VOTERS:${count}`);
        console.log(`SIM_VOTERS:${simCount}`);
        console.log(`VOTER_DETAILS:${JSON.stringify(firstVoter)}`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkVoters();

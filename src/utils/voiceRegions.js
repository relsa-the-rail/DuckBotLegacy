async function refreshRegions()
{
	try {
		let client = process.disClient;
		const regions = await client.fetchVoiceRegions();
		client.voiceRegions = regions;
	} catch (error) {
		console.error('Error fetching voice regions:', error);
	}
}

module.exports = {
    defineJobs: async () => {
        const { AgendaScheduler } = process.mongo
        AgendaScheduler.define("VoiceRegionsUpdate", refreshRegions)

        await AgendaScheduler.every("5 minutes", "VoiceRegionsUpdate", { skipImmediate: true })
		await refreshRegions()

		console.log(`Voice regions updated: ${process.disClient?.voiceRegions.size} regions available`);
    },
}
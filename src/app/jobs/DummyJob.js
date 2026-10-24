class DummyJob {
    get key() {
        return "Dummy"
    }

    async handle({data}) {
        const { message } = data;
        console.log(message);
    }
}

export default new DummyJob();

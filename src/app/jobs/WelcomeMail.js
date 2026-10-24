import Mail from "../../lib/Mail";

class WelcomeMail {
    get key() {
        return "WelcomeMail";
    }

    async handle({ data }) {
        const { name, email } = data;
        await Mail.send({
            to: { name, address: email },
            subject: "Bem-vindo ao Dominando Node.js!",
            text: `Olá, ${name}!\n\nSeu cadastro foi realizado com sucesso.\n\nBem-vindo ao Dominando Node.js!`,
        });
    }
}

export default new WelcomeMail();
